import { describe, it, expect } from "vitest";
import { analyzeBeamDeflection } from "./compute";

// Shared SI-ish (mm, N) section properties, hand-checkable against closed forms.
const E = 200000; // MPa (N/mm^2), steel
const I = 8e6; // mm^4

describe("analyzeBeamDeflection — closed-form checks (within 0.5%)", () => {
  it("simply-supported, center point load: deltaMax = P L^3 / 48 E I", () => {
    const L = 3000;
    const P = 10000;
    const result = analyzeBeamDeflection({
      E,
      I,
      L,
      support: "simple",
      pointLoads: [{ x: L / 2, P }],
      udls: [],
    });

    const expected = (P * L ** 3) / (48 * E * I); // = 3.515625 mm
    expect(result.maxDeflection.x).toBeCloseTo(L / 2, 1);
    expect(Math.abs(result.maxDeflection.v - expected) / expected).toBeLessThan(0.005);

    // Reactions: symmetric center load splits evenly.
    expect(result.reactions.Ra).toBeCloseTo(P / 2, 3);
    expect(result.reactions.Rb).toBeCloseTo(P / 2, 3);

    // Endpoints must satisfy the simple-support boundary conditions.
    expect(result.v[0]).toBeCloseTo(0, 6);
    expect(result.v[result.v.length - 1]).toBeCloseTo(0, 6);
  });

  it("simply-supported, full-span UDL: deltaMax = 5 w L^4 / 384 E I", () => {
    const L = 3000;
    const w = 5;
    const result = analyzeBeamDeflection({
      E,
      I,
      L,
      support: "simple",
      pointLoads: [],
      udls: [{ x1: 0, x2: L, w }],
    });

    const expected = (5 * w * L ** 4) / (384 * E * I); // = 3.2958984375 mm
    expect(result.maxDeflection.x).toBeCloseTo(L / 2, 1);
    expect(Math.abs(result.maxDeflection.v - expected) / expected).toBeLessThan(0.005);

    expect(result.reactions.Ra).toBeCloseTo((w * L) / 2, 3);
    expect(result.reactions.Rb).toBeCloseTo((w * L) / 2, 3);
  });

  it("cantilever, end point load: deltaTip = P L^3 / 3 E I", () => {
    const L = 2000;
    const P = 5000;
    const result = analyzeBeamDeflection({
      E,
      I,
      L,
      support: "cantilever",
      pointLoads: [{ x: L, P }],
      udls: [],
    });

    const expected = (P * L ** 3) / (3 * E * I); // = 8.33333 mm
    expect(result.maxDeflection.x).toBeCloseTo(L, 1);
    expect(Math.abs(result.maxDeflection.v - expected) / expected).toBeLessThan(0.005);

    expect(result.reactions.R).toBeCloseTo(P, 3);
    expect(result.reactions.Mr).toBeCloseTo(P * L, 3);

    // Fixed-end boundary conditions: zero deflection and zero slope at x=0.
    expect(result.v[0]).toBeCloseTo(0, 6);
    expect(result.slope[0]).toBeCloseTo(0, 6);
  });

  it("cantilever, full-span UDL: deltaTip = w L^4 / 8 E I", () => {
    const L = 2000;
    const w = 4;
    const result = analyzeBeamDeflection({
      E,
      I,
      L,
      support: "cantilever",
      pointLoads: [],
      udls: [{ x1: 0, x2: L, w }],
    });

    const expected = (w * L ** 4) / (8 * E * I); // = 5 mm exactly
    expect(result.maxDeflection.x).toBeCloseTo(L, 1);
    expect(Math.abs(result.maxDeflection.v - expected) / expected).toBeLessThan(0.005);

    expect(result.reactions.R).toBeCloseTo(w * L, 3);
    expect(result.reactions.Mr).toBeCloseTo((w * L * L) / 2, 3);
  });

  it("combined load (superposition): SS beam with center point load + full-span UDL", () => {
    const L = 3000;
    const P = 10000;
    const w = 5;
    const result = analyzeBeamDeflection({
      E,
      I,
      L,
      support: "simple",
      pointLoads: [{ x: L / 2, P }],
      udls: [{ x1: 0, x2: L, w }],
    });

    const fromPoint = (P * L ** 3) / (48 * E * I);
    const fromUDL = (5 * w * L ** 4) / (384 * E * I);
    const expected = fromPoint + fromUDL; // = 6.8115234375 mm — linear elasticity superposes

    expect(result.maxDeflection.x).toBeCloseTo(L / 2, 1);
    expect(Math.abs(result.maxDeflection.v - expected) / expected).toBeLessThan(0.005);
  });
});

describe("analyzeBeamDeflection — error guards", () => {
  const base = {
    E,
    I,
    L: 1000,
    support: "simple" as const,
    pointLoads: [],
    udls: [],
  };

  it("throws for non-positive length", () => {
    expect(() => analyzeBeamDeflection({ ...base, L: 0 })).toThrow(/length/i);
    expect(() => analyzeBeamDeflection({ ...base, L: -5 })).toThrow(/length/i);
  });

  it("throws for non-positive E or I (EI <= 0)", () => {
    expect(() => analyzeBeamDeflection({ ...base, E: 0 })).toThrow(/modulus/i);
    expect(() => analyzeBeamDeflection({ ...base, I: -1 })).toThrow(/inertia/i);
  });

  it("throws for a point load outside [0, L]", () => {
    expect(() =>
      analyzeBeamDeflection({ ...base, pointLoads: [{ x: -1, P: 10 }] }),
    ).toThrow(/outside/i);
    expect(() =>
      analyzeBeamDeflection({ ...base, pointLoads: [{ x: 1500, P: 10 }] }),
    ).toThrow(/outside/i);
  });

  it("throws for a UDL outside or with an invalid span", () => {
    expect(() =>
      analyzeBeamDeflection({ ...base, udls: [{ x1: 0, x2: 2000, w: 1 }] }),
    ).toThrow(/invalid|outside/i);
    expect(() =>
      analyzeBeamDeflection({ ...base, udls: [{ x1: 600, x2: 400, w: 1 }] }),
    ).toThrow(/invalid|outside/i);
  });
});
