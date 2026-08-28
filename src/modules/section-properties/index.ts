import type { ModuleDef, ModuleContext } from "../../core/types";
import { el, append, card, result, fmt, numberField, selectField } from "../../core/dom";
import { Plot, PALETTE } from "../../core/plot";
import { u } from "../../core/units";
import { sectionProperties, type Shape, type ShapeKind } from "./compute";

/** Serializable module state (share URLs / save files / examples). */
interface SectionState {
  shapes: Shape[];
}

const SHAPE_KINDS: ShapeKind[] = ["rectangle", "circle", "triangle"];

function readState(raw: unknown): Shape[] | null {
  const s = raw as Partial<SectionState> | undefined;
  if (!s || !Array.isArray(s.shapes) || s.shapes.length === 0) return null;
  const ok = s.shapes.every(
    (sh) =>
      sh &&
      SHAPE_KINDS.includes(sh.kind as ShapeKind) &&
      [sh.x, sh.y, sh.a, sh.b].every((n) => typeof n === "number" && Number.isFinite(n)),
  );
  return ok
    ? s.shapes.map((sh) => ({
        kind: sh.kind as ShapeKind,
        x: sh.x,
        y: sh.y,
        a: sh.a,
        b: sh.b,
        hole: !!sh.hole,
      }))
    : null;
}

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

  examples: [
    {
      title: "T-beam composite (SI: mm)",
      state: {
        shapes: [
          { kind: "rectangle", x: -90, y: 180, a: 200, b: 20 },
          { kind: "rectangle", x: -10, y: 0, a: 20, b: 180 },
        ],
      },
    },
    {
      title: "Rectangular tube with hole (SI: mm)",
      state: {
        shapes: [
          { kind: "rectangle", x: 0, y: 0, a: 100, b: 150 },
          { kind: "rectangle", x: 10, y: 10, a: 80, b: 130, hole: true },
        ],
      },
    },
    {
      title: "L-shaped angle bracket (SI: mm)",
      state: {
        shapes: [
          { kind: "rectangle", x: 0, y: 0, a: 100, b: 20 },
          { kind: "rectangle", x: 0, y: 20, a: 20, b: 80 },
        ],
      },
    },
  ],

  mount(root, ctx?: ModuleContext) {
    const shapes: Shape[] = readState(ctx?.initialState) ?? [
      { kind: "rectangle", x: 0, y: 5, a: 6, b: 1 },
      { kind: "rectangle", x: 2.5, y: 0, a: 1, b: 5 },
    ];

    const listEl = el("div", { class: "shape-list" });
    const resultsEl = el("div", { "aria-live": "polite" });
    const canvas = el("canvas", {
      role: "img",
      "aria-label": "Cross-section outline with centroid marker",
    });
    const plot = new Plot(canvas, 460, 360);

    const labelsFor = (k: ShapeKind): [string, string] =>
      k === "rectangle"
        ? ["Width", "Height"]
        : k === "circle"
          ? ["Diameter", "—"]
          : ["Base", "Height"];

    function redraw() {
      ctx?.reportState({ shapes: shapes.map((s) => ({ ...s })) });

      // --- compute ---
      const res = sectionProperties(shapes);
      resultsEl.replaceChildren(
        card(
          "Results",
          result("Area", fmt(res.area), u("area")),
          result("Centroid x̄", fmt(res.centroidX), u("length")),
          result("Centroid ȳ", fmt(res.centroidY), u("length")),
          result("Iₓ (centroidal)", fmt(res.Ix), u("inertia")),
          result("I_y (centroidal)", fmt(res.Iy), u("inertia")),
          result("I_xy", fmt(res.Ixy), u("inertia")),
          result("J = Iₓ + I_y", fmt(res.J), u("inertia")),
          result("rₓ", fmt(res.rx), u("length")),
          result("r_y", fmt(res.ry), u("length")),
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
        .axes(`x (${u("length")})`, `y (${u("length")})`, 6);

      const ctx2 = plot.ctx;
      shapes.forEach((s, i) => {
        ctx2.fillStyle = s.hole ? PALETTE.bg : PALETTE.series[i % PALETTE.series.length];
        ctx2.globalAlpha = s.hole ? 1 : 0.5;
        ctx2.strokeStyle = PALETTE.series[i % PALETTE.series.length];
        ctx2.lineWidth = 1.6;
        ctx2.beginPath();
        if (s.kind === "circle") {
          const [px, py] = plot.project(s.x, s.y);
          const [px2] = plot.project(s.x + s.a / 2, s.y);
          ctx2.arc(px, py, Math.abs(px2 - px), 0, Math.PI * 2);
        } else if (s.kind === "rectangle") {
          const [x0, y0] = plot.project(s.x, s.y);
          const [x1, y1] = plot.project(s.x + s.a, s.y + s.b);
          ctx2.rect(x0, y1, x1 - x0, y0 - y1);
        } else {
          const a = plot.project(s.x, s.y);
          const b = plot.project(s.x + s.a, s.y);
          const c = plot.project(s.x, s.y + s.b);
          ctx2.moveTo(a[0], a[1]);
          ctx2.lineTo(b[0], b[1]);
          ctx2.lineTo(c[0], c[1]);
          ctx2.closePath();
        }
        ctx2.fill();
        ctx2.stroke();
        ctx2.globalAlpha = 1;
      });
      // centroid marker (guard against NaN when net area is 0, e.g. all holes)
      if (Number.isFinite(res.centroidX) && Number.isFinite(res.centroidY)) {
        plot.dot(res.centroidX, res.centroidY, PALETTE.green, 5);
        plot.label(res.centroidX, res.centroidY, "C", PALETTE.green);
      }
    }

    // renderList() rebuilds the shape rows; it is called only when the list
    // structure changes (add/remove/shape-kind), never on a numeric keystroke —
    // otherwise replaceChildren would destroy the input being typed in.
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
              renderList(); // shape kind changes which fields/labels are shown
            },
          }),
          numberField({
            label: "x",
            unit: u("length"),
            value: s.x,
            onInput: (v) => ((s.x = v), redraw()),
          }),
          numberField({
            label: "y",
            unit: u("length"),
            value: s.y,
            onInput: (v) => ((s.y = v), redraw()),
          }),
          numberField({
            label: aLbl,
            unit: u("length"),
            value: s.a,
            onInput: (v) => ((s.a = v), redraw()),
          }),
          s.kind !== "circle"
            ? numberField({
                label: bLbl,
                unit: u("length"),
                value: s.b,
                onInput: (v) => ((s.b = v), redraw()),
              })
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
      el("h3", { class: "card-title" }, "Shapes"),
      listEl,
      el(
        "button",
        {
          class: "btn",
          onClick: () => {
            shapes.push({ kind: "rectangle", x: 0, y: 0, a: 2, b: 2 });
            renderList();
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
    renderList();
  },
};

export default module;
