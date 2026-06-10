import type { ModuleDef } from "../../core/types";
import { el, card, result, fmt, numberField, selectField } from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { vesselAnalysis, type VesselInput, type VesselType } from "./compute";

/**
 * Pressure Vessels — hoop and longitudinal stress in thin-walled
 * cylindrical and spherical pressure vessels.
 */
const module: ModuleDef = {
  id: "pressure-vessel",
  title: "Pressure Vessels",
  category: "Stress & Strain",
  description:
    "Hoop and longitudinal stress in thin-walled cylindrical and spherical vessels.",
  icon: "🛢️",

  mount(root) {
    const input: VesselInput = { p: 2, r: 10, t: 0.5, type: "cylinder" };

    const resultsEl = el("div", {});
    const canvas = el("canvas");
    const plot = new Plot(canvas, 460, 360);

    /* ---------- drawing helper ---------- */

    function drawArrow(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: string,
      width: number,
    ) {
      const ctx = plot.ctx;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // arrowhead
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const hl = 7;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - hl * Math.cos(angle - Math.PI / 6),
        y2 - hl * Math.sin(angle - Math.PI / 6),
      );
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - hl * Math.cos(angle + Math.PI / 6),
        y2 - hl * Math.sin(angle + Math.PI / 6),
      );
      ctx.stroke();
    }

    function drawSchematic() {
      const { type, r, t } = input;
      const maxDim = Math.max(r + t + 3, 6);

      plot
        .setBounds({
          xMin: -maxDim,
          xMax: maxDim,
          yMin: -maxDim,
          yMax: maxDim,
        })
        .clear();

      const ctx = plot.ctx;
      const [cx, cy] = plot.project(0, 0);

      // ---- vessel outline ----
      if (r + t > 0) {
        ctx.strokeStyle = PALETTE.series[0];
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        const [, outerPt] = plot.project(r + t, 0);
        const outerR = Math.abs(outerPt - cx);
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.stroke();

        // inner radius (dashed)
        if (r > 0) {
          ctx.strokeStyle = PALETTE.muted;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          const [, innerPt] = plot.project(r, 0);
          const innerR = Math.abs(innerPt - cx);
          ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // ---- stress arrows ----
      if (type === "cylinder") {
        const midR = r + t / 2;
        const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
        for (const a of angles) {
          const [px, py] = plot.project(
            midR * Math.cos(a),
            midR * Math.sin(a),
          );
          // tangent direction (perpendicular to radius)
          const tx = -Math.sin(a) * 22;
          const ty = Math.cos(a) * 22;
          drawArrow(px, py, px + tx, py + ty, PALETTE.series[1], 1.6);
        }
        // hoop label
        plot.label(r + t + 1.8, 0.6, "σ_h", PALETTE.series[1]);
        // longitudinal indicator
        plot.label(0, r + t + 1.8, "σ_l ⊙", PALETTE.series[2]);
      } else {
        // sphere — radial outward arrows
        const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
        for (const a of angles) {
          const startR = r + t;
          const endR = startR + 1.8;
          const [sx, sy] = plot.project(
            startR * Math.cos(a),
            startR * Math.sin(a),
          );
          const [ex, ey] = plot.project(
            endR * Math.cos(a),
            endR * Math.sin(a),
          );
          drawArrow(sx, sy, ex, ey, PALETTE.series[1], 1.6);
        }
        plot.label(r + t + 2.3, 0, "σ", PALETTE.series[1]);
      }
    }

    /* ---------- redraw ---------- */

    function redraw() {
      const res = vesselAnalysis(input);

      if (!res) {
        resultsEl.replaceChildren(
          el("p", { class: "warn" }, "⚠ Radius and thickness must be positive."),
        );
        drawSchematic();
        return;
      }

      const thickWall = !res.thinWallValid;
      const children: (Node | string)[] = [
        card(
          "Results",
          result("Hoop stress σ_h", fmt(res.hoop), "force/len²"),
          result("Longitudinal stress σ_l", fmt(res.longitudinal), "force/len²"),
          result("Max in-plane shear τ_max,ip", fmt(res.maxInPlaneShear), "force/len²"),
          result("Abs max shear τ_max,abs", fmt(res.absMaxShear), "force/len²"),
          result("r / t ratio", fmt(res.ratioRT, 4)),
        ),
      ];
      children.push(
        thickWall
          ? el("p", { class: "warn" }, `⚠ r/t = ${fmt(res.ratioRT, 3)} < 10 — thin-wall assumption not valid.`)
          : el("p", { class: "note" }, "✓ Thin-wall valid (r/t ≥ 10)"),
      );
      resultsEl.replaceChildren(...children);

      drawSchematic();
    }

    /* ---------- controls ---------- */

    const controls = el(
      "div",
      {},
      el("h3", { class: "card-title" }, "Inputs"),
      numberField({
        label: "Gauge pressure p",
        value: input.p,
        step: 0.1,
        min: 0,
        onInput: (v: number) => {
          input.p = v;
          redraw();
        },
      }),
      numberField({
        label: "Inner radius r",
        value: input.r,
        step: 0.1,
        min: 0,
        onInput: (v: number) => {
          input.r = v;
          redraw();
        },
      }),
      numberField({
        label: "Wall thickness t",
        value: input.t,
        step: 0.01,
        min: 0,
        onInput: (v: number) => {
          input.t = v;
          redraw();
        },
      }),
      selectField({
        label: "Vessel type",
        value: input.type,
        options: [
          { value: "cylinder", label: "Cylinder" },
          { value: "sphere", label: "Sphere" },
        ],
        onChange: (v: string) => {
          input.type = v as VesselType;
          redraw();
        },
      }),
      el(
        "p",
        { class: "hint" },
        "Thin-wall theory assumes r/t ≥ 10. Positive p = internal gauge pressure.",
      ),
    );

    root.append(
      el("div", {}, controls, resultsEl),
      el("div", {}, canvas),
    );
    redraw();
  },
};

export default module;
