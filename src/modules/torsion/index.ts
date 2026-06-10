import type { ModuleDef } from "../../core/types";
import { el, append, card, result as resultRow, fmt, numberField } from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { torsionAnalysis, type SegmentInput } from "./compute";

/**
 * Torsion — shear stress and angle of twist in circular shafts and stepped
 * assemblies. Pure math in compute.ts; DOM wiring and canvas plotting here.
 */
const module: ModuleDef = {
  id: "torsion",
  title: "Torsion",
  category: "Axial & Torsion",
  description:
    "Shear stress and angle of twist in circular shafts and stepped assemblies.",
  icon: "🌀",

  mount(root) {
    const segments: SegmentInput[] = [
      { L: 12, G: 1, do: 4, di: 0, T: 100 },
    ];

    const listEl = el("div", {});
    const resultsEl = el("div", {});
    const canvas = el("canvas");
    const plot = new Plot(canvas, 460, 360);
    const warnEl = el("div", { class: "warn", style: "display:none" });

    function redraw() {
      // ── compute ──────────────────────────────────────────────
      let result;
      try {
        result = torsionAnalysis(segments);
        warnEl.style.display = "none";
      } catch (e) {
        warnEl.textContent = (e as Error).message;
        warnEl.style.display = "block";
        result = null;
      }

      // ── results panel ────────────────────────────────────────
      if (result && result.segments.length > 0) {
        const segCards = result.segments.map((s, i) =>
          card(
            `Segment ${i + 1}`,
            resultRow("J", fmt(s.J), "len⁴"),
            resultRow("T_internal", fmt(s.Tinternal), "force·len"),
            resultRow("τ_max", fmt(s.tauMax), "force/len²"),
            resultRow("φ", fmt(s.phi), "rad"),
          ),
        );

        resultsEl.replaceChildren(
          ...segCards,
          card(
            "Total Twist",
            resultRow("φ_total", fmt(result.totalTwistRad), "rad"),
            resultRow("φ_total", fmt(result.totalTwistDeg), "deg"),
          ),
        );
      } else {
        resultsEl.replaceChildren(
          el("p", { class: "hint" }, "Add a segment to see results."),
        );
      }

      // ── step plot of internal torque ─────────────────────────
      if (result && result.segments.length > 0) {
        const pts: [number, number][] = [];
        let x = 0;
        for (let i = 0; i < result.segments.length; i++) {
          const T = result.segments[i].Tinternal;
          pts.push([x, T]);
          x += segments[i].L;
          pts.push([x, T]);
        }

        const Ts = result.segments.map((s) => s.Tinternal);
        const tMin = Math.min(0, ...Ts);
        const tMax = Math.max(0, ...Ts);
        const tPad = Math.max(Math.abs(tMax - tMin) * 0.2, 1);

        plot
          .setBounds({
            xMin: 0,
            xMax: x,
            yMin: tMin - tPad,
            yMax: tMax + tPad,
          })
          .clear()
          .axes("Position (len)", "Torque (force·len)");

        plot.fillToZero(pts, PALETTE.fillPos, PALETTE.fillNeg);
        plot.line(pts, PALETTE.series[0], 2);

        // Annotate total twist near the right side
        const midY = (tMax + tMin) / 2;
        plot.label(
          x * 0.55,
          midY + tPad * 0.4,
          `φ = ${fmt(result.totalTwistRad)} rad`,
          PALETTE.text,
        );
      } else if (result) {
        // Empty — show bare axes
        plot
          .setBounds({ xMin: 0, xMax: 10, yMin: -1, yMax: 1 })
          .clear()
          .axes("Position (len)", "Torque (force·len)");
      }
    }

    // Rebuilds the segment rows; called only on add/remove, never on a numeric
    // keystroke (replaceChildren would drop focus from the input being edited).
    function renderList() {
      listEl.replaceChildren();
      segments.forEach((s, i) => {
        const row = el("div", { class: "card" });
        append(
          row,
          numberField({
            label: "L",
            value: s.L,
            step: 0.1,
            min: 0.001,
            onInput: (v) => {
              s.L = v;
              redraw();
            },
          }),
          numberField({
            label: "G",
            value: s.G,
            step: 0.1,
            min: 0.001,
            onInput: (v) => {
              s.G = v;
              redraw();
            },
          }),
          numberField({
            label: "dₒ",
            value: s.do,
            step: 0.1,
            min: 0.001,
            onInput: (v) => {
              s.do = v;
              redraw();
            },
          }),
          numberField({
            label: "dᵢ (0 = solid)",
            value: s.di,
            step: 0.1,
            min: 0,
            onInput: (v) => {
              s.di = v;
              redraw();
            },
          }),
          numberField({
            label: "T",
            value: s.T,
            step: 1,
            onInput: (v) => {
              s.T = v;
              redraw();
            },
          }),
          el(
            "button",
            {
              class: "btn secondary",
              style: "margin-top:8px",
              onClick: () => {
                segments.splice(i, 1);
                if (segments.length === 0) {
                  segments.push({ L: 12, G: 1, do: 4, di: 0, T: 100 });
                }
                renderList();
              },
            },
            "Remove",
          ),
        );
        listEl.append(row);
      });
      redraw();
    }

    const controls = el(
      "div",
      {},
      el("h3", { class: "card-title" }, "Segments"),
      listEl,
      el(
        "button",
        {
          class: "btn",
          onClick: () => {
            segments.push({ L: 5, G: 1, do: 3, di: 0, T: 50 });
            renderList();
          },
        },
        "+ Add segment",
      ),
      el(
        "p",
        { class: "hint" },
        "Node 0 is fixed. Torque Tᵢ is applied at node i (right-hand positive).",
      ),
      warnEl,
    );

    root.append(
      el("div", {}, controls, resultsEl),
      el("div", {}, canvas),
    );
    renderList();
  },
};

export default module;
