import type { ModuleDef, ModuleContext } from "../../core/types";
import {
  el,
  card,
  result as resultRow,
  fmt,
  numberField,
  selectField,
} from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { u } from "../../core/units";
import {
  combinedLoadingAnalysis,
  type CombinedLoadingInput,
  type ShaftShape,
} from "./compute";

/** Serializable module state (share URLs / save files / examples). */
type CombinedLoadingState = CombinedLoadingInput;

function readState(raw: unknown): CombinedLoadingState | null {
  const s = raw as Partial<CombinedLoadingState> | undefined;
  if (!s) return null;
  if (s.shape !== "solid" && s.shape !== "hollow") return null;
  const nums = [s.do, s.di, s.P, s.T, s.M];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return {
    shape: s.shape,
    do: s.do as number,
    // A solid shaft always carries di = 0, regardless of what was restored.
    di: s.shape === "solid" ? 0 : (s.di as number),
    P: s.P as number,
    T: s.T as number,
    M: s.M as number,
  };
}

/**
 * Combined Loading — axial force + torsion + bending on a circular shaft.
 * Pure math in compute.ts; DOM wiring and canvas plotting here.
 *
 * We evaluate the plane-stress state at the outer surface, at the extreme
 * fiber where the axial and bending normal stresses add (σx = σ_axial +
 * σ_bend, σy = 0, τxy = τ_torsion), then reduce it to principal stresses via
 * Mohr's circle, exactly as in stress-transform — duplicated here in
 * compute.ts because modules may not import each other.
 */
const module: ModuleDef = {
  id: "combined-loading",
  title: "Combined Loading",
  category: "Stress & Strain",
  description:
    "Axial force, torsion, and bending on a circular shaft, reduced to principal stresses via Mohr's circle.",
  icon: "🧵",

  examples: [
    {
      title: "Solid drive shaft: T + M (SI: mm, N)",
      units: "si",
      state: {
        shape: "solid",
        do: 60,
        di: 0,
        P: 0,
        T: 2e6,
        M: 1.5e6,
      } satisfies CombinedLoadingState,
    },
    {
      title: "Tension + torsion shaft (SI: mm, N)",
      units: "si",
      state: {
        shape: "solid",
        do: 50,
        di: 0,
        P: 80000,
        T: 6e5,
        M: 0,
      } satisfies CombinedLoadingState,
    },
    {
      title: "Hollow shaft: full combined loading (SI: mm, N)",
      units: "si",
      state: {
        shape: "hollow",
        do: 80,
        di: 60,
        P: 0,
        T: 3e6,
        M: 2e6,
      } satisfies CombinedLoadingState,
    },
  ],

  mount(root, ctx?: ModuleContext) {
    const state: CombinedLoadingState = readState(ctx?.initialState) ?? {
      shape: "solid",
      do: 60,
      di: 0,
      P: 0,
      T: 2e6,
      M: 1.5e6,
    };

    const resultsEl = el("div", { "aria-live": "polite" });
    const warnEl = el("div", { class: "warn", style: "display:none" });
    const canvas = el("canvas", {
      role: "img",
      "aria-label":
        "Mohr's circle for the combined axial, bending, and torsional stress state at the outer fiber",
    });
    const plot = new Plot(canvas, 460, 400);

    // Fields that only make sense for a hollow section — hidden for solid.
    let diField: HTMLElement | null = null;

    function redraw() {
      ctx?.reportState({ ...state });

      // ── compute ──────────────────────────────────────────────
      let r: ReturnType<typeof combinedLoadingAnalysis> | null = null;
      try {
        r = combinedLoadingAnalysis(state);
        warnEl.style.display = "none";
      } catch (e) {
        warnEl.textContent = (e as Error).message;
        warnEl.style.display = "block";
      }

      // ── results panel ────────────────────────────────────────
      if (r) {
        resultsEl.replaceChildren(
          card(
            "Section Properties",
            resultRow("A", fmt(r.A), u("area")),
            resultRow("I", fmt(r.I), u("inertia")),
            resultRow("J", fmt(r.J), u("inertia")),
          ),
          card(
            "Stresses at Outer Fiber",
            resultRow("σ_axial", fmt(r.sigmaAxial), u("stress")),
            resultRow("σ_bend", fmt(r.sigmaBend), u("stress")),
            resultRow("τ_torsion", fmt(r.tauTorsion), u("stress")),
            resultRow("σx (= σ_axial + σ_bend)", fmt(r.sx), u("stress")),
          ),
          card(
            "Principal Stresses",
            resultRow("σ₁", fmt(r.sigma1), u("stress")),
            resultRow("σ₂", fmt(r.sigma2), u("stress")),
            resultRow("τ_max (in-plane)", fmt(r.tauMaxInPlane), u("stress")),
            resultRow("τ_max (absolute)", fmt(r.tauMaxAbsolute), u("stress")),
            resultRow("θₚ", fmt(r.thetaPdeg), u("angleDeg")),
          ),
        );
      } else {
        resultsEl.replaceChildren(
          el("p", { class: "hint" }, "Fix the inputs above to see results."),
        );
      }

      // ── Mohr's circle ─────────────────────────────────────────
      // Convention: τ plotted DOWNWARD-positive (standard Mohr's-circle
      // convention). The circle passes through the x-face point (σx, −τxy)
      // and the y-face point (σy, +τxy); its diameter is the line between
      // them.
      if (r) {
        const tauSpan = Math.max(Math.abs(r.txy), r.tauMaxInPlane, 1);
        const pad = Math.max(tauSpan * 0.25, 1);
        const xMin = Math.min(r.sigma2, r.sx, r.sy) - pad;
        const xMax = Math.max(r.sigma1, r.sx, r.sy) + pad;
        const yExt = tauSpan + pad;

        // Equal axis scaling so the circle renders round: force both axes
        // to span the same world-unit range, centered on their own middles.
        const xSpan = xMax - xMin;
        const ySpan = 2 * yExt;
        const span = Math.max(xSpan, ySpan);
        const xMid = (xMin + xMax) / 2;

        plot
          .setBounds({
            xMin: xMid - span / 2,
            xMax: xMid + span / 2,
            yMin: -span / 2,
            yMax: span / 2,
          })
          .clear()
          .axes(`σ (${u("stress")})`, `τ (${u("stress")})`, 8);

        // Circle, sampled in data space. Center/radius derived from σ1, σ2
        // (both are on the σ axis where τ = 0, by construction).
        const center = (r.sigma1 + r.sigma2) / 2;
        const radius = (r.sigma1 - r.sigma2) / 2;
        const N = 240;
        const pts: [number, number][] = [];
        for (let i = 0; i <= N; i++) {
          const a = (2 * Math.PI * i) / N;
          pts.push([center + radius * Math.cos(a), radius * Math.sin(a)]);
        }
        plot.line(pts, PALETTE.series[0], 2.5);

        // Diameter line between the x-face and y-face points.
        const xFace: [number, number] = [r.sx, -r.txy];
        const yFace: [number, number] = [r.sy, r.txy];
        plot.line([xFace, yFace], PALETTE.muted, 1.5);
        plot.dot(...xFace, PALETTE.series[1], 5);
        plot.label(...xFace, "X", PALETTE.series[1]);
        plot.dot(...yFace, PALETTE.series[1], 5);
        plot.label(...yFace, "Y", PALETTE.series[1]);

        // Principal points.
        plot.dot(r.sigma1, 0, PALETTE.green, 5);
        plot.label(r.sigma1, 0, "σ₁", PALETTE.green);
        plot.dot(r.sigma2, 0, PALETTE.green, 5);
        plot.label(r.sigma2, 0, "σ₂", PALETTE.green);
      } else {
        plot
          .setBounds({ xMin: -1, xMax: 1, yMin: -1, yMax: 1 })
          .clear()
          .axes(`σ (${u("stress")})`, `τ (${u("stress")})`, 8);
      }
    }

    function renderDiField() {
      diField = numberField({
        label: "dᵢ",
        unit: u("length"),
        value: state.di,
        step: 0.1,
        min: 0,
        onInput: (v) => {
          state.di = v;
          redraw();
        },
      });
      diField.style.display = state.shape === "hollow" ? "" : "none";
    }
    renderDiField();

    const shapeSelect = selectField({
      label: "Shape",
      value: state.shape,
      options: [
        { value: "solid", label: "Solid" },
        { value: "hollow", label: "Hollow" },
      ],
      onChange: (v) => {
        state.shape = v as ShaftShape;
        if (state.shape === "solid") state.di = 0;
        if (diField) {
          diField.style.display = state.shape === "hollow" ? "" : "none";
          // Keep the visible field in sync — switching solid→hollow must not
          // show a stale dᵢ while computing with state.di = 0.
          const input = diField.querySelector("input");
          if (input) input.value = String(state.di);
        }
        redraw();
      },
    });

    const controls = el(
      "div",
      {},
      card(
        "Shaft Geometry & Loads",
        shapeSelect,
        numberField({
          label: "dₒ",
          unit: u("length"),
          value: state.do,
          step: 0.1,
          min: 0.001,
          onInput: (v) => {
            state.do = v;
            redraw();
          },
        }),
        diField,
        numberField({
          label: "P (tension +)",
          unit: u("force"),
          value: state.P,
          step: 1,
          onInput: (v) => {
            state.P = v;
            redraw();
          },
        }),
        numberField({
          label: "T",
          unit: u("moment"),
          value: state.T,
          step: 1,
          onInput: (v) => {
            state.T = v;
            redraw();
          },
        }),
        numberField({
          label: "M",
          unit: u("moment"),
          value: state.M,
          step: 1,
          onInput: (v) => {
            state.M = v;
            redraw();
          },
        }),
      ),
      el(
        "p",
        { class: "hint" },
        "Analysis point: outer surface at the extreme fiber where axial and bending normal stresses add. Mohr's circle uses the downward-positive τ convention: the x-face plots at (σx, −τxy), the y-face at (σy, +τxy).",
      ),
      warnEl,
      resultsEl,
    );

    root.append(el("div", {}, controls), el("div", {}, canvas));
    redraw();
  },
};

export default module;
