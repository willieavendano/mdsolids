import type { ModuleDef, ModuleContext } from "../../core/types";
import { el, card, result, fmt, numberField } from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { u } from "../../core/units";
import { transform, principal, type StressState } from "./compute";

/** Serializable module state (share URLs / save files / examples). */
interface StressTransformState extends StressState {
  /** Rotation angle, in degrees. */
  theta: number;
}

function readState(raw: unknown): StressTransformState | null {
  const s = raw as Partial<StressTransformState> | undefined;
  if (!s) return null;
  const nums = [s.sx, s.sy, s.txy, s.theta];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) {
    return null;
  }
  return {
    sx: s.sx as number,
    sy: s.sy as number,
    txy: s.txy as number,
    theta: s.theta as number,
  };
}

/**
 * Stress Transformation — interactive Mohr's circle.
 * Plane-stress transformation, principal stresses, and a live Mohr's circle
 * that updates as you adjust inputs or the rotation angle.
 */
const module: ModuleDef = {
  id: "stress-transform",
  title: "Stress Transformation",
  category: "Stress & Strain",
  description:
    "Plane-stress transformation, principal stresses, and an interactive Mohr's circle.",
  icon: "⊕",

  examples: [
    {
      title: "Classic plane-stress state (SI: MPa)",
      state: { sx: 80, sy: -20, txy: 25, theta: 0 },
    },
    {
      title: "Pure shear (SI: MPa)",
      state: { sx: 0, sy: 0, txy: 40, theta: 0 },
    },
    {
      title: "Uniaxial tension (US: psi)",
      state: { sx: 15000, sy: 0, txy: 0, theta: 0 },
    },
  ],

  mount(root, ctx?: ModuleContext) {
    // ── state ──────────────────────────────────────────────────────
    const state: StressTransformState = readState(ctx?.initialState) ?? {
      sx: 50,
      sy: 10,
      txy: 20,
      theta: 0,
    };
    const stress: StressState = state;

    // ── DOM placeholders ───────────────────────────────────────────
    const principalEl = el("div", {});
    const transformedEl = el("div", {});
    const resultsEl = el(
      "div",
      { "aria-live": "polite" },
      principalEl,
      transformedEl,
    );
    const canvas = el("canvas", {
      role: "img",
      "aria-label":
        "Mohr's circle showing the X and Y face points, principal stresses, and the currently rotated stress state",
    });
    const plot = new Plot(canvas, 480, 400);

    // We keep a handle on the range slider so we can sync it on redraw.
    let thetaRange: HTMLInputElement | null = null;

    // ── redraw ─────────────────────────────────────────────────────
    function redraw() {
      ctx?.reportState({ ...state });

      const p = principal(stress);
      const t = transform(stress, state.theta);

      // --- results ---
      principalEl.replaceChildren(
        card(
          "Principal Stresses",
          result("σ₁", fmt(p.sigma1), u("stress")),
          result("σ₂", fmt(p.sigma2), u("stress")),
          result("θₚ", fmt(p.thetaPdeg), u("angleDeg")),
          result("θₛ (max shear)", fmt(p.thetaPdeg - 45), u("angleDeg")),
          result("τ_max", fmt(p.tauMax), u("stress")),
          result("σ_avg", fmt(p.avg), u("stress")),
        ),
      );

      transformedEl.replaceChildren(
        card(
          `Transformed at θ = ${fmt(state.theta, 4)}°`,
          result("σ_x'", fmt(t.sxp), u("stress")),
          result("σ_y'", fmt(t.syp), u("stress")),
          result("τ_x'y'", fmt(t.txyp), u("stress")),
        ),
      );

      // --- Mohr's circle ---
      drawCircle(p, t);

      // Sync range slider if it exists
      if (thetaRange) thetaRange.value = String(state.theta);
    }

    // ── Mohr's circle drawing ──────────────────────────────────────
    // Convention: τ positive DOWNWARD on the plot (standard Mohr).
    // We negate τ data-coordinates so positive shear maps below the σ axis.
    function drawCircle(p: ReturnType<typeof principal>, t: ReturnType<typeof transform>) {
      // Bounding box — include the circle and all labelled points
      const tauSpan = Math.max(
        Math.abs(stress.txy),
        Math.abs(t.txyp),
        p.radius,
      );
      const pad = Math.max(tauSpan * 0.25, 2);
      const xMin = Math.min(p.sigma2, stress.sx, stress.sy, t.sxp) - pad;
      const xMax = Math.max(p.sigma1, stress.sx, stress.sy, t.sxp) + pad;
      const yExt = tauSpan + pad;

      plot
        .setBounds({ xMin, xMax, yMin: -yExt, yMax: yExt })
        .clear()
        .axes(`σ (${u("stress")})`, `τ (${u("stress")})`, 8);

      // ── Mohr's circle (sampled in data space, τ negated for downward-positive) ──
      const N = 240;
      const pts: [number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const a = (2 * Math.PI * i) / N;
        pts.push([p.center + p.radius * Math.cos(a), -p.radius * Math.sin(a)]);
      }
      plot.line(pts, PALETTE.series[0], 2.5);

      // ── X and Y face points (diametrically opposite) ──
      const xFaceX = stress.sx;
      const xFaceY = -stress.txy; // τ negated
      const yFaceX = stress.sy;
      const yFaceY = stress.txy; // Y face has −τ in physics → +τ negated = τ_xy

      // Diameter line
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

      // ── Principal points ──
      plot.dot(p.sigma1, 0, PALETTE.green, 5);
      plot.label(p.sigma1, 0, "σ₁", PALETTE.green);

      plot.dot(p.sigma2, 0, PALETTE.green, 5);
      plot.label(p.sigma2, 0, "σ₂", PALETTE.green);

      // ── Current rotated state ──
      const rotX = t.sxp;
      const rotY = -t.txyp;
      plot.dot(rotX, rotY, PALETTE.series[2], 5);
      plot.label(rotX, rotY, `${fmt(state.theta, 3)}°`, PALETTE.series[2]);
    }

    // ── theta control: number field + range slider synchronized ────
    function thetaControl(): HTMLElement {
      const num = el("input", {
        type: "number",
        value: String(state.theta),
        step: "1",
        min: "-180",
        max: "180",
        style: "width:100%",
      }) as HTMLInputElement;

      const range = (thetaRange = el("input", {
        type: "range",
        min: "-180",
        max: "180",
        value: String(state.theta),
        step: "1",
        style: "width:100%;margin-top:2px",
      }) as HTMLInputElement);

      num.addEventListener("input", () => {
        const v = parseFloat(num.value);
        if (isNaN(v)) return;
        state.theta = v;
        range.value = String(v);
        redraw();
      });

      range.addEventListener("input", () => {
        state.theta = parseFloat(range.value);
        num.value = String(state.theta);
        redraw();
      });

      return el(
        "div",
        { class: "field-row", style: "flex-direction:column;align-items:stretch" },
        el(
          "label",
          {},
          el("span", {}, "θ"),
          num,
          el("span", { class: "unit" }, u("angleDeg")),
        ),
        range,
      );
    }

    // ── assemble left column ───────────────────────────────────────
    const controls = el(
      "div",
      {},
      card(
        "Stress State",
        numberField({
          label: "σ_x",
          value: stress.sx,
          unit: u("stress"),
          onInput: (v) => {
            stress.sx = v;
            redraw();
          },
        }),
        numberField({
          label: "σ_y",
          value: stress.sy,
          unit: u("stress"),
          onInput: (v) => {
            stress.sy = v;
            redraw();
          },
        }),
        numberField({
          label: "τ_xy",
          value: stress.txy,
          unit: u("stress"),
          onInput: (v) => {
            stress.txy = v;
            redraw();
          },
        }),
      ),
      card("Rotation", thetaControl()),
      resultsEl,
    );

    // ── mount ──────────────────────────────────────────────────────
    root.append(
      el("div", {}, controls),
      el("div", {}, canvas),
    );
    redraw();
  },
};

export default module;
