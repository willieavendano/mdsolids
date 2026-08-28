import type { ModuleDef, ModuleContext } from "../../core/types";
import { el, append, card, result, fmt, numberField } from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { u } from "../../core/units";
import { axialAnalysis, type SegmentInput } from "./compute";

/** Serializable module state (share URLs / save files / examples). */
interface AxialState {
  segments: SegmentInput[];
}

function readState(raw: unknown): SegmentInput[] | null {
  const s = raw as Partial<AxialState> | undefined;
  if (!s || !Array.isArray(s.segments) || s.segments.length === 0) return null;
  const ok = s.segments.every(
    (seg) =>
      seg &&
      [seg.L, seg.A, seg.E, seg.P].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      ),
  );
  return ok
    ? s.segments.map((seg) => ({ L: seg.L, A: seg.A, E: seg.E, P: seg.P }))
    : null;
}

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

  examples: [
    {
      title: "Stepped steel bar (SI: mm, N)",
      state: {
        segments: [
          { L: 500, A: 300, E: 200000, P: -20000 },
          { L: 300, A: 150, E: 200000, P: 30000 },
        ],
      },
    },
    {
      title: "Aluminum rod in tension (SI: mm, N)",
      state: {
        segments: [{ L: 800, A: 200, E: 70000, P: 15000 }],
      },
    },
    {
      title: "Stepped steel bar, US units (in, lb)",
      state: {
        segments: [
          { L: 20, A: 0.75, E: 29000000, P: -4000 },
          { L: 15, A: 0.4, E: 29000000, P: 6000 },
        ],
      },
    },
  ],

  mount(root, ctx?: ModuleContext) {
    const segments: SegmentInput[] = readState(ctx?.initialState) ?? [
      { L: 1.5, A: 0.5, E: 200, P: -8 },
      { L: 1.0, A: 0.25, E: 200, P: 12 },
    ];

    const listEl = el("div", {});
    const resultsEl = el("div", { "aria-live": "polite" });
    const barCanvas = el("canvas", {
      role: "img",
      "aria-label": "Bar assembly diagram showing segments and applied loads",
    });
    const diagCanvas = el("canvas", {
      role: "img",
      "aria-label": "Internal axial force diagram along the bar",
    });
    const diag = new Plot(diagCanvas, 480, 240);

    function redraw() {
      ctx?.reportState({ segments: segments.map((s) => ({ ...s })) });

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
              `N=${fmt(r.N)} ${u("force")}  σ=${fmt(r.sigma)} ${u("stress")}  δ=${fmt(r.delta)} ${u("length")}`),
          ),
        );
      });
      rows.push(result("Total elongation", fmt(res.totalElongation), u("length")));
      resultsEl.replaceChildren(card("Results", ...rows));

      drawBar(res.displacements);
      drawDiagram(res);
    }

    function drawBar(disp: number[]) {
      const barCtx = barCanvas.getContext("2d");
      if (!barCtx) return;
      const dpr = window.devicePixelRatio || 1;
      const W = 480, H = 120;
      barCanvas.style.width = `${W}px`;
      barCanvas.style.height = `${H}px`;
      barCanvas.width = W * dpr;
      barCanvas.height = H * dpr;
      barCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      barCtx.fillStyle = PALETTE.bg;
      barCtx.fillRect(0, 0, W, H);

      const total = segments.reduce((s, g) => s + Math.max(g.L, 0), 0) || 1;
      const padL = 30, padR = 20, midY = H / 2;
      const scale = (W - padL - padR) / total;
      // Fixed wall + hatch
      barCtx.strokeStyle = PALETTE.axis;
      barCtx.lineWidth = 2;
      barCtx.beginPath();
      barCtx.moveTo(padL, midY - 30);
      barCtx.lineTo(padL, midY + 30);
      barCtx.stroke();
      for (let y = midY - 30; y < midY + 30; y += 8) {
        barCtx.beginPath();
        barCtx.moveTo(padL, y);
        barCtx.lineTo(padL - 7, y + 7);
        barCtx.stroke();
      }

      let x = padL;
      segments.forEach((s, i) => {
        const w = Math.max(s.L, 0) * scale;
        const h = Math.min(46, 14 + Math.sqrt(Math.max(s.A, 0)) * 18);
        barCtx.fillStyle = PALETTE.series[i % PALETTE.series.length];
        barCtx.globalAlpha = 0.45;
        barCtx.fillRect(x, midY - h / 2, w, h);
        barCtx.globalAlpha = 1;
        barCtx.strokeStyle = PALETTE.series[i % PALETTE.series.length];
        barCtx.strokeRect(x, midY - h / 2, w, h);
        // load arrow at right node
        if (s.P !== 0) {
          const dir = s.P > 0 ? 1 : -1;
          barCtx.strokeStyle = PALETTE.orange;
          barCtx.fillStyle = PALETTE.orange;
          const ax = x + w;
          barCtx.beginPath();
          barCtx.moveTo(ax, midY);
          barCtx.lineTo(ax + dir * 22, midY);
          barCtx.stroke();
          barCtx.beginPath();
          barCtx.moveTo(ax + dir * 22, midY);
          barCtx.lineTo(ax + dir * 14, midY - 4);
          barCtx.lineTo(ax + dir * 14, midY + 4);
          barCtx.fill();
        }
        x += w;
      });
      barCtx.fillStyle = PALETTE.muted;
      barCtx.font = "11px ui-monospace, monospace";
      barCtx.fillText("fixed", 2, midY - 34);
      barCtx.fillStyle = PALETTE.green;
      barCtx.fillText(`u_end = ${fmt(disp[disp.length - 1])} ${u("length")}`, W - 160, 14);
    }

    function drawDiagram(res: ReturnType<typeof axialAnalysis>) {
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
        .axes(`Position x (${u("length")})`, `N(x) (${u("force")})`, 6);
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
          numberField({
            label: "Length L",
            unit: u("length"),
            value: s.L,
            onInput: (v) => ((s.L = v), redraw()),
          }),
          numberField({
            label: "Area A",
            unit: u("area"),
            value: s.A,
            onInput: (v) => ((s.A = v), redraw()),
          }),
          numberField({
            label: "Modulus E",
            unit: u("stress"),
            value: s.E,
            step: 10,
            onInput: (v) => ((s.E = v), redraw()),
          }),
          numberField({
            label: "Load P at right node (+tension)",
            unit: u("force"),
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
