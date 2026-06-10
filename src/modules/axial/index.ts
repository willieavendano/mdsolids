import type { ModuleDef } from "../../core/types";
import { el, append, card, result, fmt, numberField } from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { axialAnalysis, type SegmentInput } from "./compute";

/**
 * Axial Deformation — a segmented bar fixed at the left end, with an external
 * axial load applied at each segment's right node. Shows internal force, normal
 * stress, and elongation per segment, plus the internal axial-force diagram.
 */
const module: ModuleDef = {
  id: "axial",
  title: "Axial Deformation",
  category: "Axial & Torsion",
  description:
    "Normal stress and elongation of axially loaded bars and segmented assemblies.",
  icon: "🔩",

  mount(root) {
    const segments: SegmentInput[] = [
      { L: 1.5, A: 0.5, E: 200, P: -8 },
      { L: 1.0, A: 0.25, E: 200, P: 12 },
    ];

    const listEl = el("div", {});
    const resultsEl = el("div", {});
    const barCanvas = el("canvas");
    const diagCanvas = el("canvas");
    const diag = new Plot(diagCanvas, 480, 240);

    function redraw() {
      const bad = segments.some((s) => s.A <= 0 || s.E <= 0 || s.L <= 0);
      const res = axialAnalysis(segments);

      // ----- results -----
      const rows: (Node | string)[] = [];
      if (bad) rows.push(el("p", { class: "warn" }, "L, A, E must all be > 0."));
      segments.forEach((_, i) => {
        const r = res.segments[i];
        rows.push(
          el("div", { class: "result" },
            el("span", { class: "result-label" }, `Seg ${i + 1}`),
            el("span", { class: "result-value" },
              `N=${fmt(r.N)}  σ=${fmt(r.sigma)}  δ=${fmt(r.delta)}`),
          ),
        );
      });
      rows.push(result("Total elongation", fmt(res.totalElongation), "len"));
      resultsEl.replaceChildren(card("Results", ...rows));

      drawBar(res.displacements);
      drawDiagram();
    }

    function drawBar(disp: number[]) {
      const ctx = barCanvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const W = 480, H = 120;
      barCanvas.style.width = `${W}px`;
      barCanvas.style.height = `${H}px`;
      barCanvas.width = W * dpr;
      barCanvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(0, 0, W, H);

      const total = segments.reduce((s, g) => s + Math.max(g.L, 0), 0) || 1;
      const padL = 30, padR = 20, midY = H / 2;
      const scale = (W - padL - padR) / total;
      // Fixed wall + hatch
      ctx.strokeStyle = PALETTE.axis;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padL, midY - 30);
      ctx.lineTo(padL, midY + 30);
      ctx.stroke();
      for (let y = midY - 30; y < midY + 30; y += 8) {
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL - 7, y + 7);
        ctx.stroke();
      }

      let x = padL;
      segments.forEach((s, i) => {
        const w = Math.max(s.L, 0) * scale;
        const h = Math.min(46, 14 + Math.sqrt(Math.max(s.A, 0)) * 18);
        ctx.fillStyle = PALETTE.series[i % PALETTE.series.length];
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x, midY - h / 2, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = PALETTE.series[i % PALETTE.series.length];
        ctx.strokeRect(x, midY - h / 2, w, h);
        // load arrow at right node
        if (s.P !== 0) {
          const dir = s.P > 0 ? 1 : -1;
          ctx.strokeStyle = PALETTE.orange;
          ctx.fillStyle = PALETTE.orange;
          const ax = x + w;
          ctx.beginPath();
          ctx.moveTo(ax, midY);
          ctx.lineTo(ax + dir * 22, midY);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ax + dir * 22, midY);
          ctx.lineTo(ax + dir * 14, midY - 4);
          ctx.lineTo(ax + dir * 14, midY + 4);
          ctx.fill();
        }
        x += w;
      });
      ctx.fillStyle = PALETTE.muted;
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText("fixed", 2, midY - 34);
      ctx.fillStyle = PALETTE.green;
      ctx.fillText(`u_end = ${fmt(disp[disp.length - 1])}`, W - 140, 14);
    }

    function drawDiagram() {
      const res = axialAnalysis(segments);
      const pts: [number, number][] = [];
      let x = 0;
      segments.forEach((s, i) => {
        const N = res.segments[i].N;
        pts.push([x, N]);
        x += Math.max(s.L, 0);
        pts.push([x, N]);
      });
      const total = x || 1;
      const Ns = res.segments.map((s) => s.N);
      const yMax = Math.max(0, ...Ns), yMin = Math.min(0, ...Ns);
      diag
        .setBounds({ xMin: 0, xMax: total, yMin, yMax })
        .clear()
        .axes("position x", "N(x)", 6);
      if (pts.length) {
        diag.fillToZero(pts, PALETTE.fillPos, PALETTE.fillNeg);
        diag.line(pts, PALETTE.cyan, 2);
      }
    }

    function renderList() {
      listEl.replaceChildren();
      segments.forEach((s, i) => {
        const row = el("div", { class: "card" });
        append(
          row,
          el("div", { class: "card-title" }, `Segment ${i + 1}`),
          numberField({ label: "Length L", value: s.L, onInput: (v) => ((s.L = v), redraw()) }),
          numberField({ label: "Area A", value: s.A, onInput: (v) => ((s.A = v), redraw()) }),
          numberField({ label: "Modulus E", value: s.E, step: 10, onInput: (v) => ((s.E = v), redraw()) }),
          numberField({
            label: "Load P at right node (+tension)",
            value: s.P,
            onInput: (v) => ((s.P = v), redraw()),
          }),
          el("button", {
            class: "btn secondary",
            onClick: () => {
              segments.splice(i, 1);
              if (segments.length === 0) segments.push({ L: 1, A: 0.5, E: 200, P: 10 });
              renderList();
              redraw();
            },
          }, "Remove"),
        );
        listEl.append(row);
      });
    }

    const controls = el(
      "div",
      {},
      el("h3", { class: "card-title" }, "Segments (fixed end at left)"),
      listEl,
      el("button", {
        class: "btn",
        onClick: () => {
          segments.push({ L: 1, A: 0.5, E: 200, P: 0 });
          renderList();
          redraw();
        },
      }, "+ Add segment"),
      resultsEl,
    );

    root.append(
      el("div", {}, controls),
      el("div", {}, barCanvas, el("div", { style: "height:10px" }), diagCanvas),
    );
    renderList();
    redraw();
  },
};

export default module;
