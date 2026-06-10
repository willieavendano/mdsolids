import type { ModuleDef } from "../../core/types";
import { el, card, result, fmt, numberField } from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { transform, principal, type StressState } from "./compute";

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

  mount(root) {
    // ── state ──────────────────────────────────────────────────────
    const stress: StressState = { sx: 50, sy: 10, txy: 20 };
    let theta = 0;

    // ── DOM placeholders ───────────────────────────────────────────
    const principalEl = el("div", {});
    const transformedEl = el("div", {});
    const canvas = el("canvas");
    const plot = new Plot(canvas, 480, 400);

    // We keep a handle on the range slider so we can sync it on redraw.
    let thetaRange: HTMLInputElement | null = null;

    // ── redraw ─────────────────────────────────────────────────────
    function redraw() {
      const p = principal(stress);
      const t = transform(stress, theta);

      // --- results ---
      principalEl.replaceChildren(
        card(
          "Principal Stresses",
          result("σ₁", fmt(p.sigma1), "stress"),
          result("σ₂", fmt(p.sigma2), "stress"),
          result("θₚ", fmt(p.thetaPdeg), "deg"),
          result("θₛ (max shear)", fmt(p.thetaPdeg - 45), "deg"),
          result("τ_max", fmt(p.tauMax), "stress"),
          result("σ_avg", fmt(p.avg), "stress"),
        ),
      );

      transformedEl.replaceChildren(
        card(
          `Transformed at θ = ${fmt(theta, 4)}°`,
          result("σ_x'", fmt(t.sxp), "stress"),
          result("σ_y'", fmt(t.syp), "stress"),
          result("τ_x'y'", fmt(t.txyp), "stress"),
        ),
      );

      // --- Mohr's circle ---
      drawCircle(p, t);

      // Sync range slider if it exists
      if (thetaRange) thetaRange.value = String(theta);
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
        .axes("σ", "τ", 8);

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
      plot.label(rotX, rotY, `${fmt(theta, 3)}°`, PALETTE.series[2]);
    }

    // ── theta control: number field + range slider synchronized ────
    function thetaControl(): HTMLElement {
      const num = el("input", {
        type: "number",
        value: String(theta),
        step: "1",
        min: "-180",
        max: "180",
        style: "width:100%",
      }) as HTMLInputElement;

      const range = (thetaRange = el("input", {
        type: "range",
        min: "-180",
        max: "180",
        value: String(theta),
        step: "1",
        style: "width:100%;margin-top:2px",
      }) as HTMLInputElement);

      num.addEventListener("input", () => {
        const v = parseFloat(num.value);
        if (isNaN(v)) return;
        theta = v;
        range.value = String(v);
        redraw();
      });

      range.addEventListener("input", () => {
        theta = parseFloat(range.value);
        num.value = String(theta);
        redraw();
      });

      return el(
        "div",
        { class: "field-row", style: "flex-direction:column;align-items:stretch" },
        el("label", {}, el("span", {}, "θ"), num, el("span", { class: "unit" }, "deg")),
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
          onInput: (v) => {
            stress.sx = v;
            redraw();
          },
        }),
        numberField({
          label: "σ_y",
          value: stress.sy,
          onInput: (v) => {
            stress.sy = v;
            redraw();
          },
        }),
        numberField({
          label: "τ_xy",
          value: stress.txy,
          onInput: (v) => {
            stress.txy = v;
            redraw();
          },
        }),
      ),
      card("Rotation", thetaControl()),
      principalEl,
      transformedEl,
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
