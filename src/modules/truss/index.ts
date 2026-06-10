import type { ModuleDef } from "../../core/types";
import { el, append, card, fmt, numberField, selectField } from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { analyzeTruss, type Node as TNode, type Member, type SupportKind } from "./compute";

/**
 * Truss Analysis — build a 2D pin-jointed truss (nodes, supports, loads,
 * members) and solve member forces by the method of joints. Members are colored
 * by tension/compression and sized by force magnitude.
 */
const SUPPORTS: { value: SupportKind; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "pin", label: "Pin (x+y)" },
  { value: "roller-x", label: "Roller (vert. reaction)" },
  { value: "roller-y", label: "Roller (horiz. reaction)" },
];

const module: ModuleDef = {
  id: "truss",
  title: "Truss Analysis",
  category: "Structures",
  description: "Member forces in a pin-jointed truss by the method of joints.",
  icon: "🔺",

  mount(root) {
    const nodes: TNode[] = [
      { id: "A", x: 0, y: 0, support: "pin", load: { fx: 0, fy: 0 } },
      { id: "B", x: 4, y: 0, support: "roller-x", load: { fx: 0, fy: 0 } },
      { id: "C", x: 2, y: 3, support: "free", load: { fx: 0, fy: -10 } },
    ];
    const members: Member[] = [
      { a: "A", b: "B" },
      { a: "B", b: "C" },
      { a: "A", b: "C" },
    ];

    const nodeListEl = el("div", {});
    const memberListEl = el("div", {});
    const resultsEl = el("div", {});
    const canvas = el("canvas");
    const plot = new Plot(canvas, 500, 420);

    const nextNodeId = (): string => {
      for (let i = 0; i < 26; i++) {
        const c = String.fromCharCode(65 + i);
        if (!nodes.some((n) => n.id === c)) return c;
      }
      return `N${nodes.length}`;
    };

    function redraw() {
      const res = analyzeTruss(nodes, members);

      // ----- results -----
      const rows: (Node | string)[] = [];
      if (!res.determinate)
        rows.push(el("p", { class: "warn" }, "Truss is not statically determinate (M + reactions ≠ 2·nodes)."));
      if (!res.stable)
        rows.push(el("p", { class: "warn" }, "Unstable / mechanism — equilibrium has no unique solution."));
      members.forEach((m, i) => {
        const f = res.memberForces[i];
        const color =
          f.kind === "tension" ? "var(--cyan)" : f.kind === "compression" ? "var(--pink)" : "var(--muted)";
        rows.push(
          el("div", { class: "result" },
            el("span", { class: "result-label" }, `${m.a}–${m.b}`),
            el("span", { class: "result-value", style: `color:${color}` },
              `${fmt(Math.abs(f.force))} ${f.kind === "zero" ? "(zero)" : f.kind === "tension" ? "T" : "C"}`),
          ),
        );
      });
      res.reactions.forEach((r) => {
        const parts: string[] = [];
        if (r.rx !== undefined) parts.push(`Rx=${fmt(r.rx)}`);
        if (r.ry !== undefined) parts.push(`Ry=${fmt(r.ry)}`);
        rows.push(
          el("div", { class: "result" },
            el("span", { class: "result-label" }, `Reaction @ ${r.node}`),
            el("span", { class: "result-value" }, parts.join("  ")),
          ),
        );
      });
      resultsEl.replaceChildren(card("Results", ...rows));

      drawTruss(res);
    }

    function drawTruss(res: ReturnType<typeof analyzeTruss>) {
      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
      const pad = span * 0.18;
      plot
        .setBounds({
          xMin: Math.min(...xs) - pad,
          xMax: Math.max(...xs) + pad,
          yMin: Math.min(...ys) - pad,
          yMax: Math.max(...ys) + pad,
        })
        .clear();

      const ctx = plot.ctx;
      const maxF = Math.max(1, ...res.memberForces.map((f) => Math.abs(f.force)));
      const byId = new Map(nodes.map((n) => [n.id, n]));

      // members
      members.forEach((m, i) => {
        const a = byId.get(m.a), b = byId.get(m.b);
        if (!a || !b) return;
        const f = res.memberForces[i];
        const [x0, y0] = plot.project(a.x, a.y);
        const [x1, y1] = plot.project(b.x, b.y);
        ctx.strokeStyle =
          f.kind === "tension" ? PALETTE.cyan : f.kind === "compression" ? PALETTE.pink : PALETTE.muted;
        ctx.lineWidth = 1.5 + 5 * (Math.abs(f.force) / maxF);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        // force label at midpoint
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = "10px ui-monospace, monospace";
        if (f.kind !== "zero")
          ctx.fillText(fmt(Math.abs(f.force), 3), (x0 + x1) / 2 + 4, (y0 + y1) / 2 - 4);
      });

      // nodes + supports + loads
      nodes.forEach((n) => {
        plot.dot(n.x, n.y, PALETTE.text, 5);
        plot.label(n.x, n.y, n.id, PALETTE.text, 7, -7);
        const [px, py] = plot.project(n.x, n.y);
        if (n.support !== "free") {
          ctx.strokeStyle = PALETTE.green;
          ctx.fillStyle = "rgba(138,255,128,0.18)";
          ctx.lineWidth = 1.5;
          ctx.beginPath(); // support triangle
          ctx.moveTo(px, py);
          ctx.lineTo(px - 9, py + 15);
          ctx.lineTo(px + 9, py + 15);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        // load arrow
        const { fx, fy } = n.load;
        if (fx !== 0 || fy !== 0) {
          const mag = Math.hypot(fx, fy);
          const ux = (fx / mag) * 32, uy = (-fy / mag) * 32; // screen y is down
          ctx.strokeStyle = PALETTE.orange;
          ctx.fillStyle = PALETTE.orange;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + ux, py + uy);
          ctx.stroke();
          const ang = Math.atan2(uy, ux);
          ctx.beginPath();
          ctx.moveTo(px + ux, py + uy);
          ctx.lineTo(px + ux - 7 * Math.cos(ang - 0.4), py + uy - 7 * Math.sin(ang - 0.4));
          ctx.lineTo(px + ux - 7 * Math.cos(ang + 0.4), py + uy - 7 * Math.sin(ang + 0.4));
          ctx.fill();
        }
      });
    }

    function renderNodes() {
      nodeListEl.replaceChildren();
      nodes.forEach((n, i) => {
        const row = el("div", { class: "card" });
        append(
          row,
          el("div", { class: "card-title" }, `Node ${n.id}`),
          numberField({ label: "x", value: n.x, onInput: (v) => ((n.x = v), redraw()) }),
          numberField({ label: "y", value: n.y, onInput: (v) => ((n.y = v), redraw()) }),
          selectField({
            label: "Support",
            value: n.support,
            options: SUPPORTS,
            onChange: (v) => ((n.support = v as SupportKind), redraw()),
          }),
          numberField({ label: "Load Fx", value: n.load.fx, onInput: (v) => ((n.load.fx = v), redraw()) }),
          numberField({ label: "Load Fy", value: n.load.fy, onInput: (v) => ((n.load.fy = v), redraw()) }),
          el("button", {
            class: "btn secondary",
            onClick: () => {
              const id = n.id;
              nodes.splice(i, 1);
              for (let k = members.length - 1; k >= 0; k--)
                if (members[k].a === id || members[k].b === id) members.splice(k, 1);
              renderAll();
            },
          }, "Remove"),
        );
        nodeListEl.append(row);
      });
    }

    function renderMembers() {
      memberListEl.replaceChildren();
      const opts = nodes.map((n) => ({ value: n.id, label: n.id }));
      members.forEach((m, i) => {
        const row = el("div", { class: "card" });
        append(
          row,
          el("div", { class: "field-row", style: "gap:8px;align-items:flex-end" },
            selectField({ label: "From", value: m.a, options: opts, onChange: (v) => ((m.a = v), redraw()) }),
            selectField({ label: "To", value: m.b, options: opts, onChange: (v) => ((m.b = v), redraw()) }),
            el("button", {
              class: "btn secondary",
              onClick: () => { members.splice(i, 1); renderMembers(); redraw(); },
            }, "✕"),
          ),
        );
        memberListEl.append(row);
      });
    }

    function renderAll() {
      renderNodes();
      renderMembers();
      redraw();
    }

    const controls = el(
      "div",
      {},
      el("h3", { class: "card-title" }, "Nodes"),
      nodeListEl,
      el("button", {
        class: "btn",
        onClick: () => {
          nodes.push({ id: nextNodeId(), x: 0, y: 0, support: "free", load: { fx: 0, fy: 0 } });
          renderAll();
        },
      }, "+ Add node"),
      el("h3", { class: "card-title", style: "margin-top:16px" }, "Members"),
      memberListEl,
      el("button", {
        class: "btn",
        onClick: () => {
          if (nodes.length >= 2) {
            members.push({ a: nodes[0].id, b: nodes[1].id });
            renderMembers();
            redraw();
          }
        },
      }, "+ Add member"),
      resultsEl,
    );

    root.append(
      el("div", {}, controls),
      el("div", {}, canvas, el("p", { class: "hint" }, "Cyan = tension, pink = compression, thickness ∝ |force|.")),
    );
    renderAll();
  },
};

export default module;
