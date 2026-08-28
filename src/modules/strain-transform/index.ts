import type { ModuleDef, ModuleContext } from "../../core/types";
import { el, card, result as resultRow, fmt, numberField, selectField } from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { u } from "../../core/units";
import {
  transformStrain,
  principalStrains,
  rosette45,
  rosette60,
  type PrincipalStrainResult,
  type TransformedStrain,
} from "./compute";

type Mode = "strain" | "rosette45" | "rosette60";

/** Serializable module state (share URLs / save files / examples). */
interface StrainTransformState {
  mode: Mode;
  ex: number;
  ey: number;
  gxy: number;
  theta: number;
  ea: number;
  eb: number;
  ec: number;
}

const DEFAULT_STATE: StrainTransformState = {
  mode: "strain",
  ex: 500,
  ey: -300,
  gxy: 600,
  theta: 0,
  ea: 500,
  eb: 400,
  ec: -300,
};

const MODES: Mode[] = ["strain", "rosette45", "rosette60"];

function readState(raw: unknown): StrainTransformState | null {
  const s = raw as Partial<StrainTransformState> | undefined;
  if (!s || typeof s.mode !== "string" || !MODES.includes(s.mode as Mode)) return null;
  const fields = [s.ex, s.ey, s.gxy, s.theta, s.ea, s.eb, s.ec];
  if (!fields.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return {
    mode: s.mode as Mode,
    ex: s.ex as number,
    ey: s.ey as number,
    gxy: s.gxy as number,
    theta: s.theta as number,
    ea: s.ea as number,
    eb: s.eb as number,
    ec: s.ec as number,
  };
}

/**
 * Strain Transformation — plane-strain transformation, principal strains,
 * and reduction of rectangular (45°) and delta (60°) strain-rosette
 * readings, with a live Mohr's circle for strain. Pure math in compute.ts;
 * DOM wiring and canvas plotting here.
 */
const module: ModuleDef = {
  id: "strain-transform",
  title: "Strain Transformation",
  category: "Stress & Strain",
  description:
    "Plane-strain transformation, principal strains, and rectangular/delta strain-rosette reduction with a live Mohr's circle.",
  icon: "🧭",

  examples: [
    {
      title: "Plane strain state (με)",
      units: "generic",
      state: { ...DEFAULT_STATE, mode: "strain", ex: 500, ey: -300, gxy: 600, theta: 0 },
    },
    {
      title: "Rectangular rosette readings (με)",
      units: "generic",
      state: { ...DEFAULT_STATE, mode: "rosette45", ea: 500, eb: 400, ec: -300 },
    },
    {
      title: "Delta rosette readings (με)",
      units: "generic",
      state: {
        ...DEFAULT_STATE,
        mode: "rosette60",
        ea: 500,
        eb: 159.80762113533155,
        ec: -359.80762113533155,
      },
    },
  ],

  mount(root, ctx?: ModuleContext) {
    const state: StrainTransformState = readState(ctx?.initialState) ?? { ...DEFAULT_STATE };

    // ── DOM placeholders ─────────────────────────────────────────────
    const fieldsEl = el("div", {});
    const resultsEl = el("div", { "aria-live": "polite" });
    const canvas = el("canvas", {
      role: "img",
      "aria-label":
        "Mohr's circle for strain, showing principal strains and the current rotation point",
    });
    const plot = new Plot(canvas, 480, 400);
    const warnEl = el("div", { class: "warn", style: "display:none" });

    function redraw() {
      // Report a copy of the current inputs so the shell can keep the
      // share-URL / save-file fresh.
      ctx?.reportState({ ...state });

      // ── compute ──────────────────────────────────────────────────
      let ex: number, ey: number, gxy: number;
      let p: PrincipalStrainResult | null = null;
      let t: TransformedStrain | null = null;
      try {
        if (state.mode === "strain") {
          ({ ex, ey, gxy } = state);
          t = transformStrain(ex, ey, gxy, state.theta);
        } else if (state.mode === "rosette45") {
          ({ ex, ey, gxy } = rosette45(state.ea, state.eb, state.ec));
        } else {
          ({ ex, ey, gxy } = rosette60(state.ea, state.eb, state.ec));
        }
        p = principalStrains(ex, ey, gxy);
        warnEl.style.display = "none";
      } catch (e) {
        warnEl.textContent = (e as Error).message;
        warnEl.style.display = "block";
        resultsEl.replaceChildren();
        plot
          .setBounds({ xMin: -1, xMax: 1, yMin: -1, yMax: 1 })
          .clear()
          .axes(`ε (${u("strain")})`, `γ/2 (${u("strain")})`);
        return;
      }

      // ── results panel ───────────────────────────────────────────
      const cards = [];
      if (t) {
        cards.push(
          card(
            `Transformed at θ = ${fmt(state.theta, 4)}°`,
            resultRow("εx'", fmt(t.ex1), u("strain")),
            resultRow("εy'", fmt(t.ey1), u("strain")),
            resultRow("γx'y'", fmt(t.gx1y1), u("strain")),
          ),
        );
      }
      cards.push(
        card(
          "Principal Strains",
          resultRow("ε₁", fmt(p.e1), u("strain")),
          resultRow("ε₂", fmt(p.e2), u("strain")),
          resultRow("θₚ", fmt(p.thetaP), u("angleDeg")),
          resultRow("γ_max (in-plane)", fmt(p.gammaMax), u("strain")),
          resultRow("ε_avg", fmt(p.eAvg), u("strain")),
        ),
      );
      resultsEl.replaceChildren(
        el("p", { class: "hint" }, "Values in microstrain (με)."),
        ...cards,
      );

      // ── Mohr's circle for strain ──────────────────────────────────
      drawCircle(ex, ey, gxy, p, t);
    }

    // ── Mohr's circle drawing (equal axis scaling so it renders round) ──
    // Convention mirrors the plane-stress Mohr's circle: the vertical axis
    // is γ/2 (half the engineering shear strain), plotted positive
    // DOWNWARD, so a "Y face" point sits diametrically opposite the "X face".
    function drawCircle(
      ex: number,
      ey: number,
      gxy: number,
      p: PrincipalStrainResult,
      t: TransformedStrain | null,
    ) {
      const halfSpan = Math.max(p.radius, 1) * 1.35;

      // Plot's internal padding is fixed (l:52 r:16 t:16 b:34); replicate
      // it here so we can pick world bounds whose aspect ratio matches the
      // plot area's pixel aspect ratio exactly — the only way to guarantee
      // a circle renders as a circle rather than an ellipse.
      const cssW = 480;
      const cssH = 400;
      const plotW = cssW - 52 - 16;
      const plotH = cssH - 16 - 34;
      const unitsPerPx = halfSpan / (Math.min(plotW, plotH) / 2);
      const xHalf = (unitsPerPx * plotW) / 2;
      const yHalf = (unitsPerPx * plotH) / 2;

      plot
        .setBounds({
          xMin: p.center - xHalf,
          xMax: p.center + xHalf,
          yMin: -yHalf,
          yMax: yHalf,
        })
        .clear()
        .axes(`ε (${u("strain")})`, `γ/2 (${u("strain")})`, 8);

      // ── the circle itself ──
      const N = 240;
      const pts: [number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const a = (2 * Math.PI * i) / N;
        pts.push([p.center + p.radius * Math.cos(a), -p.radius * Math.sin(a)]);
      }
      plot.line(pts, PALETTE.series[0], 2.5);

      // ── X and Y face points (diametrically opposite) ──
      const xFaceX = ex;
      const xFaceY = -gxy / 2;
      const yFaceX = ey;
      const yFaceY = gxy / 2;

      plot.line(
        [
          [xFaceX, xFaceY],
          [yFaceX, yFaceY],
        ],
        PALETTE.muted,
        1.5,
      );
      plot.dot(xFaceX, xFaceY, PALETTE.series[1], 5);
      plot.label(xFaceX, xFaceY, "X", PALETTE.series[1]);
      plot.dot(yFaceX, yFaceY, PALETTE.series[1], 5);
      plot.label(yFaceX, yFaceY, "Y", PALETTE.series[1]);

      // ── principal points ──
      plot.dot(p.e1, 0, PALETTE.green, 5);
      plot.label(p.e1, 0, "ε₁", PALETTE.green);
      plot.dot(p.e2, 0, PALETTE.green, 5);
      plot.label(p.e2, 0, "ε₂", PALETTE.green);

      // ── current rotation point (strain mode only) ──
      if (t) {
        const rotX = t.ex1;
        const rotY = -t.gx1y1 / 2;
        plot.dot(rotX, rotY, PALETTE.series[2], 5);
        plot.label(rotX, rotY, `${fmt(state.theta, 3)}°`, PALETTE.series[2]);
      }
    }

    // Rebuilds the input fields; called only when the MODE changes, never
    // on a numeric keystroke (replaceChildren would drop input focus).
    function renderFields() {
      fieldsEl.replaceChildren();
      if (state.mode === "strain") {
        fieldsEl.append(
          card(
            "Strain State",
            numberField({
              label: "εx",
              unit: u("strain"),
              value: state.ex,
              step: 1,
              onInput: (v) => {
                state.ex = v;
                redraw();
              },
            }),
            numberField({
              label: "εy",
              unit: u("strain"),
              value: state.ey,
              step: 1,
              onInput: (v) => {
                state.ey = v;
                redraw();
              },
            }),
            numberField({
              label: "γxy",
              unit: u("strain"),
              value: state.gxy,
              step: 1,
              onInput: (v) => {
                state.gxy = v;
                redraw();
              },
            }),
            numberField({
              label: "θ",
              unit: u("angleDeg"),
              value: state.theta,
              step: 1,
              onInput: (v) => {
                state.theta = v;
                redraw();
              },
            }),
          ),
        );
      } else {
        const isDelta = state.mode === "rosette60";
        fieldsEl.append(
          card(
            isDelta ? "Delta Rosette (0° / 60° / 120°)" : "Rectangular Rosette (0° / 45° / 90°)",
            numberField({
              label: "εa",
              unit: u("strain"),
              value: state.ea,
              step: 1,
              onInput: (v) => {
                state.ea = v;
                redraw();
              },
            }),
            numberField({
              label: "εb",
              unit: u("strain"),
              value: state.eb,
              step: 1,
              onInput: (v) => {
                state.eb = v;
                redraw();
              },
            }),
            numberField({
              label: "εc",
              unit: u("strain"),
              value: state.ec,
              step: 1,
              onInput: (v) => {
                state.ec = v;
                redraw();
              },
            }),
          ),
        );
      }
      redraw();
    }

    const modeSelect = selectField({
      label: "Mode",
      value: state.mode,
      options: [
        { value: "strain", label: "Plane strain" },
        { value: "rosette45", label: "Rosette 45° (rectangular)" },
        { value: "rosette60", label: "Rosette 60° (delta)" },
      ],
      onChange: (v) => {
        state.mode = v as Mode;
        renderFields();
      },
    });

    const controls = el("div", {}, card("Mode", modeSelect), fieldsEl, warnEl, resultsEl);

    root.append(controls, el("div", {}, canvas));
    renderFields();
  },
};

export default module;
