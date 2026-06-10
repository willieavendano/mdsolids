import type { ModuleDef } from "../../core/types";
import {
  el,
  card,
  result,
  fmt,
  numberField,
  selectField,
} from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
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

const module: ModuleDef = {
  id: "column",
  title: "Column Buckling",
  category: "Structures",
  description:
    "Euler critical load, slenderness, and buckling stress for columns.",
  icon: "🏛️",

  mount(root) {
    // --- state ---
    const state: ColumnInput = {
      E: 200000,
      I: 1e6,
      A: 1000,
      L: 3000,
      K: 1,
    };
    let sigmaY = 0; // 0 = not set (elastic Euler only)

    const resultsEl = el("div", {});
    const canvas = el("canvas");
    const plot = new Plot(canvas, 500, 380);

    function redraw() {
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
          result("Effective length Lₑ", fmt(res.Le), "len"),
          result("Radius of gyration r", fmt(res.r), "len"),
          result("Slenderness λ", fmt(res.slenderness), "—"),
          result("Critical load P_cr", fmt(res.Pcr), "force"),
          result("Buckling stress σ_cr", fmt(res.sigmaCr), "stress"),
        );

        if (sigmaY > 0) {
          const lambdaTrans = transitionSlenderness(state.E, sigmaY);
          const elastic = res.sigmaCr <= sigmaY;
          children.push(
            result("Yield stress σ_Y", fmt(sigmaY), "stress"),
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
          if (sigmaY > 0) yMax = Math.max(yMax, sigmaY);
          yMax *= 1.1;

          plot
            .setBounds({
              xMin: rmin,
              xMax: rmax,
              yMin: 0,
              yMax,
            })
            .axes("Slenderness λ", "σ_cr", 7);

          // Euler hyperbola
          plot.line(
            curve.map((p) => [p.slenderness, p.sigmaCr]),
            PALETTE.series[0],
            2,
          );

          // Yield stress line if set
          if (sigmaY > 0) {
            plot.line(
              [
                [rmin, sigmaY],
                [rmax, sigmaY],
              ],
              PALETTE.series[2],
              1.5,
            );
            plot.label(rmin, sigmaY, `σ_Y = ${fmt(sigmaY)}`, PALETTE.series[2]);
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
        step: 1000,
        onInput: (v) => {
          state.E = v;
          redraw();
        },
      }),
      numberField({
        label: "Moment of inertia I",
        value: state.I,
        step: 1000,
        onInput: (v) => {
          state.I = v;
          redraw();
        },
      }),
      numberField({
        label: "Area A",
        value: state.A,
        step: 100,
        onInput: (v) => {
          state.A = v;
          redraw();
        },
      }),
      numberField({
        label: "Length L",
        value: state.L,
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
        value: sigmaY || 0,
        step: 10,
        onInput: (v) => {
          sigmaY = v;
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
