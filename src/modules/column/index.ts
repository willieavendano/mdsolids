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
import {
  columnAnalysis,
  transitionSlenderness,
  eulerCurve,
  END_CONDITIONS,
  type ColumnInput,
} from "./compute";

const endOptions = Object.entries(END_CONDITIONS).map(([name, k]) => ({
  value: String(k),
  label: `${name}  (K=${k})`,
}));

const VALID_K = new Set(Object.values(END_CONDITIONS));

/** Serializable module state (share URLs / save files / examples). */
interface ColumnState extends ColumnInput {
  /** Yield stress; 0 = not set (elastic Euler curve only). */
  sigmaY: number;
}

function readState(raw: unknown): ColumnState | null {
  const s = raw as Partial<ColumnState> | undefined;
  if (!s) return null;
  const nums = [s.E, s.I, s.A, s.L, s.K, s.sigmaY];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) {
    return null;
  }
  if (!VALID_K.has(s.K as number)) return null;
  return {
    E: s.E as number,
    I: s.I as number,
    A: s.A as number,
    L: s.L as number,
    K: s.K as number,
    sigmaY: s.sigmaY as number,
  };
}

const module: ModuleDef = {
  id: "column",
  title: "Column Buckling",
  category: "Structures",
  description:
    "Euler critical load, slenderness, and buckling stress for columns.",
  icon: "🏛️",

  examples: [
    {
      title: "Steel pinned-pinned column (SI: mm, N)",
      units: "si",
      state: { E: 200000, I: 8490000, A: 9880, L: 6000, K: 1, sigmaY: 250 },
    },
    {
      title: "Steel fixed-free column (SI: mm, N)",
      units: "si",
      state: { E: 200000, I: 2500000, A: 4500, L: 3500, K: 2, sigmaY: 250 },
    },
    {
      title: "Steel fixed-fixed column (US: in, lb)",
      units: "us",
      state: { E: 29000000, I: 100, A: 10, L: 120, K: 0.5, sigmaY: 36000 },
    },
  ],

  mount(root, ctx?: ModuleContext) {
    // --- state ---
    const state: ColumnState = readState(ctx?.initialState) ?? {
      E: 200000,
      I: 1e6,
      A: 1000,
      L: 3000,
      K: 1,
      sigmaY: 0,
    };

    const resultsEl = el("div", { "aria-live": "polite" });
    const canvas = el("canvas", {
      role: "img",
      "aria-label":
        "Euler buckling curve of critical stress versus slenderness ratio, with the column's operating point and yield stress marked",
    });
    const plot = new Plot(canvas, 500, 380);

    function redraw() {
      ctx?.reportState({ ...state });

      const res = columnAnalysis(state);

      const singular =
        state.A <= 0 || state.I <= 0 || state.L <= 0 || state.E <= 0;

      // --- results ---
      const children: (string | Node)[] = [];

      if (singular) {
        children.push(
          el("p", { class: "warn" }, "E, I, A, and L must all be > 0."),
        );
      } else {
        children.push(
          result("Effective length Lₑ", fmt(res.Le), u("length")),
          result("Radius of gyration r", fmt(res.r), u("length")),
          result("Slenderness λ", fmt(res.slenderness), u("none")),
          result("Critical load P_cr", fmt(res.Pcr), u("force")),
          result("Buckling stress σ_cr", fmt(res.sigmaCr), u("stress")),
        );

        if (state.sigmaY > 0) {
          const lambdaTrans = transitionSlenderness(state.E, state.sigmaY);
          const elastic = res.sigmaCr <= state.sigmaY;
          children.push(
            result("Yield stress σ_Y", fmt(state.sigmaY), u("stress")),
            el(
              "p",
              { class: elastic ? "note" : "warn" },
              elastic
                ? `Elastic Euler buckling governs (σ_cr ≤ σ_Y). Transition slenderness λ_trans ≈ ${fmt(lambdaTrans)}.`
                : `Yielding governs — column reaches σ_Y before Euler buckling. Transition λ_trans ≈ ${fmt(lambdaTrans)}.`,
            ),
          );
        }
      }

      resultsEl.replaceChildren(card("Results", ...children));

      // --- plot ---
      plot.clear();

      if (!singular) {
        // Determine curve bounds — extend a bit beyond the column's slenderness.
        const lambda = res.slenderness;
        const pad = Math.max(lambda * 0.2, 20);
        const rmin = Math.max(lambda - pad, 1);
        const rmax = lambda + pad;

        const curve = eulerCurve(state.E, rmin, rmax);

        if (curve.length > 0) {
          const sigmas = curve.map((p) => p.sigmaCr);
          let yMax = Math.max(...sigmas);
          if (state.sigmaY > 0) yMax = Math.max(yMax, state.sigmaY);
          yMax *= 1.1;

          plot
            .setBounds({
              xMin: rmin,
              xMax: rmax,
              yMin: 0,
              yMax,
            })
            .axes("Slenderness λ", `σ_cr (${u("stress")})`, 7);

          // Euler hyperbola
          plot.line(
            curve.map((p) => [p.slenderness, p.sigmaCr]),
            PALETTE.series[0],
            2,
          );

          // Yield stress line if set
          if (state.sigmaY > 0) {
            plot.line(
              [
                [rmin, state.sigmaY],
                [rmax, state.sigmaY],
              ],
              PALETTE.series[2],
              1.5,
            );
            plot.label(
              rmin,
              state.sigmaY,
              `σ_Y = ${fmt(state.sigmaY)}`,
              PALETTE.series[2],
            );
          }

          // Column operating point
          plot.dot(lambda, res.sigmaCr, PALETTE.green, 6);
          plot.label(
            lambda,
            res.sigmaCr,
            `λ=${fmt(lambda)}`,
            PALETTE.green,
          );
        }
      }
    }

    // --- controls ---
    const endKStr = String(state.K);
    const matched = endOptions.find((o) => o.value === endKStr);
    const kSelect = selectField({
      label: "End condition",
      value: matched ? matched.value : "1",
      options: endOptions,
      onChange: (v) => {
        state.K = Number(v);
        redraw();
      },
    });

    const controls = el(
      "div",
      {},
      el("h3", { class: "card-title" }, "Column"),
      numberField({
        label: "Modulus E",
        value: state.E,
        unit: u("stress"),
        step: 1000,
        onInput: (v) => {
          state.E = v;
          redraw();
        },
      }),
      numberField({
        label: "Moment of inertia I",
        value: state.I,
        unit: u("inertia"),
        step: 1000,
        onInput: (v) => {
          state.I = v;
          redraw();
        },
      }),
      numberField({
        label: "Area A",
        value: state.A,
        unit: u("area"),
        step: 100,
        onInput: (v) => {
          state.A = v;
          redraw();
        },
      }),
      numberField({
        label: "Length L",
        value: state.L,
        unit: u("length"),
        step: 100,
        onInput: (v) => {
          state.L = v;
          redraw();
        },
      }),
      kSelect,
      el("hr", {}),
      numberField({
        label: "Yield stress σ_Y (optional)",
        value: state.sigmaY || 0,
        unit: u("stress"),
        step: 10,
        onInput: (v) => {
          state.sigmaY = v;
          redraw();
        },
      }),
      el(
        "p",
        { class: "hint" },
        "Set σ_Y = 0 to show the pure Euler curve only.",
      ),
      resultsEl,
    );

    root.append(
      el("div", {}, controls),
      el("div", {}, canvas),
    );

    redraw();
  },
};

export default module;
