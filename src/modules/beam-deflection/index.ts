import type { ModuleDef, ModuleContext } from "../../core/types";
import {
  el,
  append,
  card,
  result as resultRow,
  fmt,
  numberField,
  selectField,
} from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { u } from "../../core/units";
import {
  analyzeBeamDeflection,
  type SupportType,
  type PointLoadInput,
  type UDLInput,
} from "./compute";

/** Serializable module state (share URLs / save files / examples). */
interface BeamDeflectionState {
  E: number;
  I: number;
  L: number;
  support: SupportType;
  pointLoads: PointLoadInput[];
  udls: UDLInput[];
}

/** Validate untrusted state (URL / save file / example) before applying it. */
function readState(raw: unknown): BeamDeflectionState | null {
  const s = raw as Partial<BeamDeflectionState> | undefined;
  if (!s) return null;
  const isFiniteNum = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n);
  if (!isFiniteNum(s.E) || !isFiniteNum(s.I) || !isFiniteNum(s.L)) return null;
  const E = s.E;
  const I = s.I;
  const L = s.L;
  if (s.support !== "simple" && s.support !== "cantilever") return null;
  if (!Array.isArray(s.pointLoads) || !Array.isArray(s.udls)) return null;

  const pointLoads = s.pointLoads.every(
    (p) => p && [p.x, p.P].every((n) => typeof n === "number" && Number.isFinite(n)),
  )
    ? s.pointLoads.map((p) => ({ x: p.x, P: p.P }))
    : null;
  if (!pointLoads) return null;

  const udls = s.udls.every(
    (d) =>
      d && [d.x1, d.x2, d.w].every((n) => typeof n === "number" && Number.isFinite(n)),
  )
    ? s.udls.map((d) => ({ x1: d.x1, x2: d.x2, w: d.w }))
    : null;
  if (!udls) return null;

  return { E, I, L, support: s.support, pointLoads, udls };
}

/**
 * Beam Deflection — elastic curve v(x) of simply-supported and cantilever
 * beams under point loads and uniform distributed loads. Pure math lives in
 * compute.ts; this file wires it to the DOM and a canvas plot.
 */
const module: ModuleDef = {
  id: "beam-deflection",
  title: "Beam Deflection",
  category: "Beams",
  description:
    "Elastic curve, slope, and maximum deflection for simply-supported and cantilever beams.",
  icon: "📉",

  examples: [
    {
      title: "SS beam, center load (SI: mm, N)",
      state: {
        E: 200000,
        I: 8e6,
        L: 3000,
        support: "simple",
        pointLoads: [{ x: 1500, P: 10000 }],
        udls: [],
      },
    },
    {
      title: "SS beam, full-span UDL (SI: mm, N)",
      state: {
        E: 200000,
        I: 8e6,
        L: 3000,
        support: "simple",
        pointLoads: [],
        udls: [{ x1: 0, x2: 3000, w: 5 }],
      },
    },
    {
      title: "Cantilever, tip load (SI: mm, N)",
      state: {
        E: 200000,
        I: 8e6,
        L: 2000,
        support: "cantilever",
        pointLoads: [{ x: 2000, P: 5000 }],
        udls: [],
      },
    },
  ],

  mount(root, ctx?: ModuleContext) {
    // ---- state -------------------------------------------------------------
    const restored = readState(ctx?.initialState);
    let E = restored?.E ?? 1;
    let I = restored?.I ?? 1;
    let L = restored?.L ?? 10;
    let support: SupportType = restored?.support ?? "simple";
    const pointLoads: PointLoadInput[] = restored?.pointLoads ?? [{ x: 5, P: 10 }];
    const udls: UDLInput[] = restored?.udls ?? [];

    // ---- DOM elements --------------------------------------------------------
    const pointListEl = el("div", {});
    const udlListEl = el("div", {});
    const resultsEl = el("div", { "aria-live": "polite" });
    const canvas = el("canvas", {
      role: "img",
      "aria-label": "Elastic curve — beam deflection v(x) along the span",
    });
    const plot = new Plot(canvas, 460, 360);
    const warnEl = el("div", { class: "warn", style: "display:none" });

    // ---- redraw ----------------------------------------------------------------
    function redraw() {
      ctx?.reportState({
        E,
        I,
        L,
        support,
        pointLoads: pointLoads.map((p) => ({ ...p })),
        udls: udls.map((d) => ({ ...d })),
      });

      // -- compute --
      let res;
      try {
        res = analyzeBeamDeflection({ E, I, L, support, pointLoads, udls });
        warnEl.style.display = "none";
      } catch (e) {
        warnEl.textContent = (e as Error).message;
        warnEl.style.display = "block";
        res = null;
      }

      // -- results panel --
      if (res) {
        const reactionRows =
          support === "simple"
            ? [
                resultRow("Rₐ", fmt(res.reactions.Ra ?? 0), u("force")),
                resultRow("R_b", fmt(res.reactions.Rb ?? 0), u("force")),
              ]
            : [
                resultRow("R", fmt(res.reactions.R ?? 0), u("force")),
                resultRow("Mᵣ", fmt(res.reactions.Mr ?? 0), u("moment")),
              ];

        resultsEl.replaceChildren(
          card(
            "Results",
            resultRow("v_max", fmt(res.maxDeflection.v), u("length")),
            resultRow("at x", fmt(res.maxDeflection.x), u("length")),
            ...reactionRows,
          ),
        );
      } else {
        resultsEl.replaceChildren(
          el("p", { class: "hint" }, "Fix the inputs above to see results."),
        );
      }

      // -- elastic curve plot --
      // v(x) is stored downward-positive (sag = positive). We negate it for
      // the plot so a physical sag reads as a visible downward dip on-screen.
      if (res && res.x.length > 0) {
        const plotted: [number, number][] = res.x.map((xi, i) => [xi, -res.v[i]]);
        const vs = res.v;
        const yLo = -Math.max(...vs, 0);
        const yHi = -Math.min(...vs, 0);

        plot
          .setBounds({ xMin: 0, xMax: L, yMin: yLo, yMax: yHi })
          .clear()
          .axes(`Position (${u("length")})`, `Deflection (${u("length")})`);

        plot.line(plotted, PALETTE.series[0], 2);

        const mx = res.maxDeflection.x;
        const mv = res.maxDeflection.v;
        plot.dot(mx, -mv, PALETTE.pink, 5);
        plot.label(mx, -mv, `v_max = ${fmt(mv)} ${u("length")}`, PALETTE.text);
      } else {
        plot
          .setBounds({ xMin: 0, xMax: 10, yMin: -1, yMax: 1 })
          .clear()
          .axes(`Position (${u("length")})`, `Deflection (${u("length")})`);
      }
    }

    // ---- point-load list renderer -----------------------------------------------
    // Rebuilds rows; called only on add/remove, never on a numeric keystroke
    // (replaceChildren would drop focus from the input being edited).
    function renderPointList() {
      pointListEl.replaceChildren();
      pointLoads.forEach((p, i) => {
        const row = el("div", { class: "card", style: "margin-bottom:8px" });
        append(
          row,
          el(
            "div",
            { style: "display:flex;flex-wrap:wrap;gap:6px" },
            numberField({
              label: "x",
              unit: u("length"),
              value: p.x,
              step: 0.1,
              min: 0,
              onInput: (v) => {
                p.x = v;
                redraw();
              },
            }),
            numberField({
              label: "P ↓",
              unit: u("force"),
              value: p.P,
              step: 1,
              onInput: (v) => {
                p.P = v;
                redraw();
              },
            }),
          ),
          el(
            "button",
            {
              class: "btn secondary",
              style: "margin-top:4px;width:100%",
              onClick: () => {
                pointLoads.splice(i, 1);
                renderPointList();
              },
            },
            "Remove",
          ),
        );
        pointListEl.append(row);
      });
      redraw();
    }

    // ---- UDL list renderer --------------------------------------------------------
    function renderUDLList() {
      udlListEl.replaceChildren();
      udls.forEach((d, i) => {
        const row = el("div", { class: "card", style: "margin-bottom:8px" });
        append(
          row,
          el(
            "div",
            { style: "display:flex;flex-wrap:wrap;gap:6px" },
            numberField({
              label: "x₁",
              unit: u("length"),
              value: d.x1,
              step: 0.1,
              min: 0,
              onInput: (v) => {
                d.x1 = v;
                redraw();
              },
            }),
            numberField({
              label: "x₂",
              unit: u("length"),
              value: d.x2,
              step: 0.1,
              min: 0,
              onInput: (v) => {
                d.x2 = v;
                redraw();
              },
            }),
            numberField({
              label: "w ↓",
              unit: u("distLoad"),
              value: d.w,
              step: 0.1,
              onInput: (v) => {
                d.w = v;
                redraw();
              },
            }),
          ),
          el(
            "button",
            {
              class: "btn secondary",
              style: "margin-top:4px;width:100%",
              onClick: () => {
                udls.splice(i, 1);
                renderUDLList();
              },
            },
            "Remove",
          ),
        );
        udlListEl.append(row);
      });
      redraw();
    }

    // ---- build layout ------------------------------------------------------------
    const controls = el(
      "div",
      {},
      numberField({
        label: "E",
        unit: u("stress"),
        value: E,
        step: 0.1,
        min: 0.001,
        onInput: (v) => {
          E = v;
          redraw();
        },
      }),
      numberField({
        label: "I",
        unit: u("inertia"),
        value: I,
        step: 0.1,
        min: 0.001,
        onInput: (v) => {
          I = v;
          redraw();
        },
      }),
      numberField({
        label: "L",
        unit: u("length"),
        value: L,
        step: 0.1,
        min: 0.001,
        onInput: (v) => {
          L = v;
          redraw();
        },
      }),
      selectField({
        label: "Support",
        value: support,
        options: [
          { value: "simple", label: "Simply supported (pin–roller)" },
          { value: "cantilever", label: "Cantilever (fixed–free)" },
        ],
        onChange: (v) => {
          support = v as SupportType;
          redraw();
        },
      }),
      el("h3", { class: "card-title", style: "margin-top:12px" }, "Point loads"),
      pointListEl,
      el(
        "button",
        {
          class: "btn",
          onClick: () => {
            pointLoads.push({ x: L / 2, P: 10 });
            renderPointList();
          },
        },
        "+ Add point load",
      ),
      el("h3", { class: "card-title", style: "margin-top:12px" }, "Distributed loads"),
      udlListEl,
      el(
        "button",
        {
          class: "btn",
          onClick: () => {
            udls.push({ x1: 0, x2: L, w: 1 });
            renderUDLList();
          },
        },
        "+ Add UDL",
      ),
      el(
        "p",
        { class: "hint" },
        "Loads P and w act downward (↓). Deflection v is reported positive downward " +
          '(sag). "simple" pins x=0 and rollers x=L; "cantilever" fixes x=0 and leaves x=L free.',
      ),
      warnEl,
      resultsEl,
    );

    root.append(controls, el("div", {}, canvas));

    renderPointList();
    renderUDLList();
  },
};

export default module;
