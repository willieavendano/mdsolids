import type { ModuleDef, ModuleContext } from "../../core/types";
import {
  el,
  card,
  result,
  fmt,
  numberField,
  selectField,
} from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { u } from "../../core/units";
import { analyzeBeam, type Load, type BeamType } from "./compute";

/** Serializable module state (share URLs / save files / examples). */
interface BeamState {
  L: number;
  beamType: BeamType;
  loads: Load[];
}

function readState(raw: unknown): BeamState | null {
  const s = raw as { L?: unknown; beamType?: unknown; loads?: unknown } | undefined;
  if (!s || typeof s.L !== "number" || !Number.isFinite(s.L)) return null;
  if (s.beamType !== "simply-supported" && s.beamType !== "cantilever") return null;
  if (!Array.isArray(s.loads)) return null;

  const isFiniteNum = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n);

  const loads: Load[] = [];
  for (const item of s.loads) {
    const ld = item as Record<string, unknown> | null;
    if (!ld || typeof ld !== "object") return null;
    if (ld.type === "point" && isFiniteNum(ld.x) && isFiniteNum(ld.P)) {
      loads.push({ type: "point", x: ld.x, P: ld.P });
    } else if (
      ld.type === "udl" &&
      isFiniteNum(ld.xStart) &&
      isFiniteNum(ld.xEnd) &&
      isFiniteNum(ld.w)
    ) {
      loads.push({ type: "udl", xStart: ld.xStart, xEnd: ld.xEnd, w: ld.w });
    } else if (ld.type === "moment" && isFiniteNum(ld.x) && isFiniteNum(ld.M)) {
      loads.push({ type: "moment", x: ld.x, M: ld.M });
    } else {
      return null;
    }
  }

  return { L: s.L, beamType: s.beamType, loads };
}

/**
 * Beam Diagrams — reactions plus shear-force and bending-moment diagrams
 * for simply-supported and cantilever beams.
 */
const module: ModuleDef = {
  id: "beam",
  title: "Beam Diagrams",
  category: "Beams",
  description:
    "Reactions plus shear-force and bending-moment diagrams for loaded beams.",
  icon: "📏",

  examples: [
    {
      title: "Simply supported, center point load (SI: mm, N)",
      state: {
        L: 6000,
        beamType: "simply-supported",
        loads: [{ type: "point", x: 3000, P: 15000 }],
      },
    },
    {
      title: "Simply supported, uniform load (SI: mm, N)",
      state: {
        L: 5000,
        beamType: "simply-supported",
        loads: [{ type: "udl", xStart: 0, xEnd: 5000, w: 8 }],
      },
    },
    {
      title: "Cantilever, end point load (US: in, lb)",
      state: {
        L: 120,
        beamType: "cantilever",
        loads: [{ type: "point", x: 120, P: 800 }],
      },
    },
  ],

  mount(root, ctx?: ModuleContext) {
    // ---- state ----------------------------------------------------------
    const initial = readState(ctx?.initialState);
    let beamType: BeamType = initial?.beamType ?? "simply-supported";
    let L = initial?.L ?? 10;
    let loads: Load[] = initial?.loads ?? [{ type: "point", x: 5, P: 100 }];

    // ---- DOM elements ---------------------------------------------------
    const resultsEl = el("div", { "aria-live": "polite" });
    const loadListEl = el("div");

    // Shear diagram canvas
    const canvasV = el("canvas", {
      role: "img",
      "aria-label": "Shear force diagram V of x along the beam",
    });
    const plotV = new Plot(canvasV, 460, 260);

    // Moment diagram canvas
    const canvasM = el("canvas", {
      role: "img",
      "aria-label": "Bending moment diagram M of x along the beam",
    });
    const plotM = new Plot(canvasM, 460, 260);

    // ---- redraw ---------------------------------------------------------
    function redraw() {
      ctx?.reportState({
        L,
        beamType,
        loads: loads.map((ld) => ({ ...ld })),
      });

      const res = analyzeBeam({ L, type: beamType, loads });

      // -- results card --
      const children: (string | Node)[] = [];

      if (beamType === "simply-supported") {
        children.push(
          result("Rₐ", fmt(res.reactions.Ra ?? 0), u("force")),
          result("R_b", fmt(res.reactions.Rb ?? 0), u("force")),
        );
      } else {
        children.push(
          result("R", fmt(res.reactions.R ?? 0), u("force")),
          result("Mᵣ", fmt(res.reactions.Mr ?? 0), u("moment")),
        );
      }

      children.push(
        result("Vₘₐₓ", fmt(res.Vmax), u("force")),
        result("at x", fmt(res.VmaxLoc), u("length")),
        result("Vₘᵢₙ", fmt(res.Vmin), u("force")),
        result("at x", fmt(res.VminLoc), u("length")),
        result("Mₘₐₓ", fmt(res.Mmax), u("moment")),
        result("at x", fmt(res.MmaxLoc), u("length")),
        result("Mₘᵢₙ", fmt(res.Mmin), u("moment")),
        result("at x", fmt(res.MminLoc), u("length")),
      );

      if (res.warnings.length > 0) {
        children.push(
          el(
            "div",
            { class: "warn", style: "margin-top:8px;font-size:12px" },
            ...res.warnings.map((w) => el("div", {}, w)),
          ),
        );
      }

      resultsEl.replaceChildren(card("Results", ...children));

      // -- shear diagram --
      drawDiagram(
        plotV,
        res.samples.map((s) => [s.x, s.V] as [number, number]),
        L,
        res.Vmin,
        res.Vmax,
        `x (${u("length")})`,
        `V (${u("force")})`,
      );

      // -- moment diagram --
      drawDiagram(
        plotM,
        res.samples.map((s) => [s.x, s.M] as [number, number]),
        L,
        res.Mmin,
        res.Mmax,
        `x (${u("length")})`,
        `M (${u("moment")})`,
      );
    }

    // ---- diagram helper -------------------------------------------------
    function drawDiagram(
      pl: Plot,
      pts: [number, number][],
      Lval: number,
      yMin: number,
      yMax: number,
      xLabel: string,
      yLabel: string,
    ) {
      const yPad = Math.max(Math.abs(yMax - yMin) * 0.12, 0.5);
      const yLo = yMin - yPad;
      const yHi = yMax + yPad;
      const effectiveYLo = yLo >= 0 ? -yPad : yLo;
      const effectiveYHi = yHi <= 0 ? yPad : yHi;

      pl.setBounds({
        xMin: 0,
        xMax: Lval || 1,
        yMin: effectiveYLo,
        yMax: effectiveYHi,
      })
        .clear()
        .axes(xLabel, yLabel, 6);

      // filled area
      pl.fillToZero(pts, PALETTE.fillPos, PALETTE.fillNeg);

      // outline
      pl.line(pts, PALETTE.series[0], 2);
    }

    // ---- load list renderer ---------------------------------------------
    // Rebuilds the load rows; called only on add/remove/type-change, never on a
    // numeric keystroke (replaceChildren would drop focus from the edited input).
    function renderLoadList() {
      loadListEl.replaceChildren();

      const typeOptions = [
        { value: "point", label: "Point Load" },
        { value: "udl", label: "UDL" },
        { value: "moment", label: "Moment" },
      ];

      loads.forEach((ld, i) => {
        const fields: (Node | null)[] = [];

        if (ld.type === "point") {
          fields.push(
            numberField({
              label: "x",
              unit: u("length"),
              value: ld.x,
              onInput: (v) => {
                ld.x = v;
                redraw();
              },
            }),
            numberField({
              label: "P ↓",
              unit: u("force"),
              value: ld.P,
              onInput: (v) => {
                ld.P = v;
                redraw();
              },
            }),
          );
        } else if (ld.type === "udl") {
          fields.push(
            numberField({
              label: "xStart",
              unit: u("length"),
              value: ld.xStart,
              onInput: (v) => {
                ld.xStart = v;
                redraw();
              },
            }),
            numberField({
              label: "xEnd",
              unit: u("length"),
              value: ld.xEnd,
              onInput: (v) => {
                ld.xEnd = v;
                redraw();
              },
            }),
            numberField({
              label: "w ↓",
              unit: u("distLoad"),
              value: ld.w,
              onInput: (v) => {
                ld.w = v;
                redraw();
              },
            }),
          );
        } else {
          fields.push(
            numberField({
              label: "x",
              unit: u("length"),
              value: ld.x,
              onInput: (v) => {
                ld.x = v;
                redraw();
              },
            }),
            numberField({
              label: "M ↺",
              unit: u("moment"),
              value: ld.M,
              onInput: (v) => {
                ld.M = v;
                redraw();
              },
            }),
          );
        }

        const row = el(
          "div",
          { class: "card", style: "margin-bottom:8px" },
          selectField({
            label: "Type",
            value: ld.type,
            options: typeOptions,
            onChange: (v) => {
              const newType = v as Load["type"];
              // Replace with a fresh load of the new type, carrying over
              // sensible defaults from the old one.
              if (newType === "point") {
                loads[i] = {
                  type: "point",
                  x: "x" in ld ? ld.x : L / 2,
                  P: "P" in ld ? ld.P : ("w" in ld ? ld.w : 100),
                };
              } else if (newType === "udl") {
                loads[i] = {
                  type: "udl",
                  xStart: "x" in ld ? ld.x : 0,
                  xEnd: Math.min(("x" in ld ? ld.x : 0) + 1, L),
                  w: "P" in ld ? ld.P : ("w" in ld ? ld.w : 10),
                };
              } else {
                loads[i] = {
                  type: "moment",
                  x: "x" in ld ? ld.x : L / 2,
                  M: "M" in ld ? ld.M : 10,
                };
              }
              renderLoadList(); // load type changes which fields are shown
            },
          }),
          el("div", { style: "display:flex;flex-wrap:wrap;gap:6px" }, ...fields),
          el(
            "button",
            {
              class: "btn secondary",
              style: "margin-top:4px;width:100%",
              onClick: () => {
                loads.splice(i, 1);
                renderLoadList();
              },
            },
            "Remove",
          ),
        );

        loadListEl.append(row);
      });
      redraw();
    }

    // ---- build layout ---------------------------------------------------
    const controls = el(
      "div",
      {},
      selectField({
        label: "Beam type",
        value: beamType,
        options: [
          { value: "simply-supported", label: "Simply Supported" },
          { value: "cantilever", label: "Cantilever" },
        ],
        onChange: (v) => {
          beamType = v as BeamType;
          redraw();
        },
      }),
      numberField({
        label: "Length L",
        unit: u("length"),
        value: L,
        step: 0.1,
        min: 0.01,
        onInput: (v) => {
          L = v;
          redraw();
        },
      }),
      el("h3", { class: "card-title", style: "margin-top:12px" }, "Loads"),
      loadListEl,
      el(
        "button",
        {
          class: "btn",
          onClick: () => {
            loads.push({ type: "point", x: L / 2, P: 100 });
            renderLoadList();
          },
        },
        "+ Add Load",
      ),
      el(
        "p",
        { class: "hint" },
        "Point load P ↓ (down), UDL w ↓/len, applied moment M ↺ (CCW). All positions relative to left end (x = 0).",
      ),
      resultsEl,
    );

    root.append(
      el("div", {}, controls),
      el(
        "div",
        { style: "display:flex;flex-direction:column;gap:12px" },
        el(
          "div",
          {},
          el(
            "div",
            { class: "card-title", style: "margin-bottom:4px" },
            "Shear V(x)",
          ),
          canvasV,
        ),
        el(
          "div",
          {},
          el(
            "div",
            { class: "card-title", style: "margin-bottom:4px" },
            "Moment M(x)",
          ),
          canvasM,
        ),
      ),
    );

    // initial draw
    renderLoadList();
  },
};

export default module;
