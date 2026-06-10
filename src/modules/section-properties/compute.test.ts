import { describe, it, expect } from "vitest";
import { sectionProperties, shapeProps, type Shape } from "./compute";

describe("shapeProps", () => {
  it("rectangle centroid and inertia", () => {
    const p = shapeProps({ kind: "rectangle", x: 0, y: 0, a: 2, b: 4 });
    expect(p.area).toBeCloseTo(8);
    expect(p.cx).toBeCloseTo(1);
    expect(p.cy).toBeCloseTo(2);
    expect(p.ix).toBeCloseTo((2 * 4 ** 3) / 12); // 10.667
    expect(p.iy).toBeCloseTo((4 * 2 ** 3) / 12); // 2.667
  });

  it("circle inertia", () => {
    const p = shapeProps({ kind: "circle", x: 0, y: 0, a: 4, b: 0 });
    expect(p.area).toBeCloseTo(Math.PI * 4);
    expect(p.ix).toBeCloseTo((Math.PI * 2 ** 4) / 4);
  });
});

describe("sectionProperties", () => {
  it("single rectangle matches bh^3/12", () => {
    const r = sectionProperties([{ kind: "rectangle", x: 0, y: 0, a: 3, b: 6 }]);
    expect(r.area).toBeCloseTo(18);
    expect(r.centroidX).toBeCloseTo(1.5);
    expect(r.centroidY).toBeCloseTo(3);
    expect(r.Ix).toBeCloseTo((3 * 6 ** 3) / 12); // 54
    expect(r.Iy).toBeCloseTo((6 * 3 ** 3) / 12); // 13.5
    expect(r.J).toBeCloseTo(54 + 13.5);
  });

  it("T-section centroid sits above mid-height", () => {
    // Flange 6x1 on top of web 1x5.
    const shapes: Shape[] = [
      { kind: "rectangle", x: 0, y: 5, a: 6, b: 1 }, // flange
      { kind: "rectangle", x: 2.5, y: 0, a: 1, b: 5 }, // web
    ];
    const r = sectionProperties(shapes);
    expect(r.area).toBeCloseTo(11);
    // Areas: flange 6 @ y=5.5, web 5 @ y=2.5 → ybar = (6*5.5+5*2.5)/11
    expect(r.centroidY).toBeCloseTo((6 * 5.5 + 5 * 2.5) / 11);
    expect(r.centroidX).toBeCloseTo(3); // symmetric
    expect(r.Ixy).toBeCloseTo(0, 6); // symmetric about vertical centroidal axis
  });

  it("hollow box subtracts the hole", () => {
    const r = sectionProperties([
      { kind: "rectangle", x: 0, y: 0, a: 4, b: 4 },
      { kind: "rectangle", x: 1, y: 1, a: 2, b: 2, hole: true },
    ]);
    expect(r.area).toBeCloseTo(16 - 4);
    const Iouter = (4 * 4 ** 3) / 12;
    const Iinner = (2 * 2 ** 3) / 12;
    expect(r.Ix).toBeCloseTo(Iouter - Iinner);
  });
});
