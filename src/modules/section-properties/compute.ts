/**
 * Section properties of a composite cross-section made of primitive shapes.
 * Pure functions — no DOM. Units are consistent (length in, areas in², I in⁴);
 * the caller decides what the length unit means.
 */

export type ShapeKind = "rectangle" | "circle" | "triangle";

export interface Shape {
  kind: ShapeKind;
  /** Reference x of the shape's local origin (see notes per kind). */
  x: number;
  y: number;
  /** rectangle: width; circle: diameter; triangle: base. */
  a: number;
  /** rectangle: height; circle: unused; triangle: height. */
  b: number;
  /** If true, the shape is subtracted (a hole). */
  hole?: boolean;
}

export interface ShapeProps {
  area: number;
  cx: number;
  cy: number;
  /** Centroidal second moments of the individual shape. */
  ix: number;
  iy: number;
}

export interface SectionResult {
  area: number;
  centroidX: number;
  centroidY: number;
  /** Moments of inertia about the composite centroid. */
  Ix: number;
  Iy: number;
  /** Product of inertia about the composite centroid. */
  Ixy: number;
  /** Polar moment of inertia J = Ix + Iy about the centroid. */
  J: number;
  /** Radii of gyration. */
  rx: number;
  ry: number;
}

/** Area, centroid (global), and centroidal Ix/Iy of one primitive shape.
 *  Convention: (x, y) is the lower-left corner for rectangle/triangle and the
 *  center for a circle. */
export function shapeProps(s: Shape): ShapeProps {
  switch (s.kind) {
    case "rectangle": {
      const area = s.a * s.b;
      return {
        area,
        cx: s.x + s.a / 2,
        cy: s.y + s.b / 2,
        ix: (s.a * s.b ** 3) / 12,
        iy: (s.b * s.a ** 3) / 12,
      };
    }
    case "circle": {
      const r = s.a / 2;
      const area = Math.PI * r * r;
      const i = (Math.PI * r ** 4) / 4;
      return { area, cx: s.x, cy: s.y, ix: i, iy: i };
    }
    case "triangle": {
      // Right triangle, right angle at (x, y), base `a` along +x, height `b` along +y.
      const area = (s.a * s.b) / 2;
      return {
        area,
        cx: s.x + s.a / 3,
        cy: s.y + s.b / 3,
        ix: (s.a * s.b ** 3) / 36,
        iy: (s.b * s.a ** 3) / 36,
      };
    }
  }
}

/** Combine shapes (holes subtract) into composite section properties via the
 *  parallel-axis theorem. */
export function sectionProperties(shapes: Shape[]): SectionResult {
  let area = 0;
  let sx = 0;
  let sy = 0;
  const parts = shapes.map((s) => {
    const p = shapeProps(s);
    const sign = s.hole ? -1 : 1;
    area += sign * p.area;
    sx += sign * p.area * p.cx;
    sy += sign * p.area * p.cy;
    return { p, sign };
  });

  const centroidX = area !== 0 ? sx / area : 0;
  const centroidY = area !== 0 ? sy / area : 0;

  let Ix = 0;
  let Iy = 0;
  let Ixy = 0;
  for (const { p, sign } of parts) {
    const dx = p.cx - centroidX;
    const dy = p.cy - centroidY;
    Ix += sign * (p.ix + p.area * dy * dy);
    Iy += sign * (p.iy + p.area * dx * dx);
    // Primitive shapes here are symmetric about their own axes, so their local
    // product of inertia is 0; only the parallel-axis transfer term remains.
    Ixy += sign * (p.area * dx * dy);
  }

  return {
    area,
    centroidX,
    centroidY,
    Ix,
    Iy,
    Ixy,
    J: Ix + Iy,
    rx: area > 0 ? Math.sqrt(Math.abs(Ix) / area) : 0,
    ry: area > 0 ? Math.sqrt(Math.abs(Iy) / area) : 0,
  };
}
