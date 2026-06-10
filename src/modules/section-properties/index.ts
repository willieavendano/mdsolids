import type { ModuleDef } from "../../core/types";
import { el, append, card, result, fmt, numberField, selectField } from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { sectionProperties, type Shape, type ShapeKind } from "./compute";

/**
 * Section Properties — build a composite cross-section from rectangles, circles,
 * and triangles (with holes), and read off area, centroid, moments of inertia,
 * polar moment, and radii of gyration. This module is the reference example all
 * other modules follow: pure math in compute.ts, DOM wiring here.
 */
const module: ModuleDef = {
  id: "section-properties",
  title: "Section Properties",
  category: "Geometry",
  description: "Area, centroid, moments of inertia, and J of a composite cross-section.",
  icon: "▦",

  mount(root) {
    const shapes: Shape[] = [
      { kind: "rectangle", x: 0, y: 5, a: 6, b: 1 },
      { kind: "rectangle", x: 2.5, y: 0, a: 1, b: 5 },
    ];

    const listEl = el("div", { class: "shape-list" });
    const resultsEl = el("div", {});
    const canvas = el("canvas");
    const plot = new Plot(canvas, 460, 360);

    const labelsFor = (k: ShapeKind): [string, string] =>
      k === "rectangle"
        ? ["Width", "Height"]
        : k === "circle"
          ? ["Diameter", "—"]
          : ["Base", "Height"];

    function redraw() {
      // --- compute ---
      const res = sectionProperties(shapes);
      resultsEl.replaceChildren(
        card(
          "Results",
          result("Area", fmt(res.area), "len²"),
          result("Centroid x̄", fmt(res.centroidX), "len"),
          result("Centroid ȳ", fmt(res.centroidY), "len"),
          result("Iₓ (centroidal)", fmt(res.Ix), "len⁴"),
          result("I_y (centroidal)", fmt(res.Iy), "len⁴"),
          result("I_xy", fmt(res.Ixy), "len⁴"),
          result("J = Iₓ + I_y", fmt(res.J), "len⁴"),
          result("rₓ", fmt(res.rx), "len"),
          result("r_y", fmt(res.ry), "len"),
        ),
      );

      // --- draw cross-section ---
      const xs: number[] = [];
      const ys: number[] = [];
      for (const s of shapes) {
        if (s.kind === "circle") {
          xs.push(s.x - s.a / 2, s.x + s.a / 2);
          ys.push(s.y - s.a / 2, s.y + s.a / 2);
        } else {
          xs.push(s.x, s.x + s.a);
          ys.push(s.y, s.y + s.b);
        }
      }
      const pad = 1;
      plot
        .setBounds({
          xMin: Math.min(0, ...xs) - pad,
          xMax: Math.max(1, ...xs) + pad,
          yMin: Math.min(0, ...ys) - pad,
          yMax: Math.max(1, ...ys) + pad,
        })
        .clear()
        .axes("x", "y", 6);

      const ctx = plot.ctx;
      shapes.forEach((s, i) => {
        ctx.fillStyle = s.hole ? PALETTE.bg : PALETTE.series[i % PALETTE.series.length];
        ctx.globalAlpha = s.hole ? 1 : 0.5;
        ctx.strokeStyle = PALETTE.series[i % PALETTE.series.length];
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        if (s.kind === "circle") {
          const [px, py] = plot.project(s.x, s.y);
          const [px2] = plot.project(s.x + s.a / 2, s.y);
          ctx.arc(px, py, Math.abs(px2 - px), 0, Math.PI * 2);
        } else if (s.kind === "rectangle") {
          const [x0, y0] = plot.project(s.x, s.y);
          const [x1, y1] = plot.project(s.x + s.a, s.y + s.b);
          ctx.rect(x0, y1, x1 - x0, y0 - y1);
        } else {
          const a = plot.project(s.x, s.y);
          const b = plot.project(s.x + s.a, s.y);
          const c = plot.project(s.x, s.y + s.b);
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.lineTo(c[0], c[1]);
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
      // centroid marker
      plot.dot(res.centroidX, res.centroidY, PALETTE.green, 5);
      plot.label(res.centroidX, res.centroidY, "C", PALETTE.green);

      renderList();
    }

    function renderList() {
      listEl.replaceChildren();
      shapes.forEach((s, i) => {
        const [aLbl, bLbl] = labelsFor(s.kind);
        const row = el("div", { class: "card" });
        append(
          row,
          selectField({
            label: "Shape",
            value: s.kind,
            options: [
              { value: "rectangle", label: "Rectangle" },
              { value: "circle", label: "Circle" },
              { value: "triangle", label: "Right triangle" },
            ],
            onChange: (v) => {
              s.kind = v as ShapeKind;
              redraw();
            },
          }),
          numberField({ label: "x", value: s.x, onInput: (v) => ((s.x = v), redraw()) }),
          numberField({ label: "y", value: s.y, onInput: (v) => ((s.y = v), redraw()) }),
          numberField({ label: aLbl, value: s.a, onInput: (v) => ((s.a = v), redraw()) }),
          s.kind !== "circle"
            ? numberField({ label: bLbl, value: s.b, onInput: (v) => ((s.b = v), redraw()) })
            : null,
          el(
            "label",
            { class: "field-row", style: "gap:6px;margin-top:4px" },
            el("input", {
              type: "checkbox",
              checked: !!s.hole,
              onChange: (e) => {
                s.hole = (e.target as HTMLInputElement).checked;
                redraw();
              },
            }),
            el("span", { class: "note" }, "Hole (subtract)"),
          ),
          el(
            "button",
            {
              class: "btn secondary",
              style: "margin-top:8px",
              onClick: () => {
                shapes.splice(i, 1);
                if (shapes.length === 0)
                  shapes.push({ kind: "rectangle", x: 0, y: 0, a: 2, b: 2 });
                redraw();
              },
            },
            "Remove",
          ),
        );
        listEl.append(row);
      });
    }

    const controls = el(
      "div",
      {},
      el("h3", { class: "card-title" }, "Shapes"),
      listEl,
      el(
        "button",
        {
          class: "btn",
          onClick: () => {
            shapes.push({ kind: "rectangle", x: 0, y: 0, a: 2, b: 2 });
            redraw();
          },
        },
        "+ Add shape",
      ),
      el(
        "p",
        { class: "hint" },
        "Rectangle/triangle (x, y) is the lower-left / right-angle corner; circle (x, y) is its center.",
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
