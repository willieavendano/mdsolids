import { describe, it, expect } from "vitest";
import { columnAnalysis, transitionSlenderness, eulerCurve } from "./compute";

describe("columnAnalysis", () => {
  const steelE = 200000; // MPa

  it("pinned-pinned column gives Pcr = pi^2 E I / L^2", () => {
    // A 2 m long steel rod, d=20 mm circular section.
    // I = π d^4 / 64 = π·20^4 / 64 ≈ 7854 mm^4
    // A = π·10^2 ≈ 314.2 mm²
    // L = 2000 mm, K=1
    // Pcr = π²·200000·7854 / 2000² ≈ 3 875 N

    const I = (Math.PI * 20 ** 4) / 64;
    const A = Math.PI * 10 ** 2;
    const L = 2000;

    const r = columnAnalysis({ E: steelE, I, A, L, K: 1 });

    // Le = 2000
    expect(r.Le).toBeCloseTo(2000, 0);

    // r = sqrt(I/A) = sqrt(7854 / 314.2) = sqrt(25) = 5 mm
    expect(r.r).toBeCloseTo(5, 0);

    // slenderness = 2000 / 5 = 400
    expect(r.slenderness).toBeCloseTo(400, 0);

    // Pcr = π² * 200000 * 7854 / 2000²
    const expectedPcr = (Math.PI ** 2 * steelE * I) / L ** 2;
    expect(r.Pcr).toBeCloseTo(expectedPcr, -2); // ~3875 N

    // sigmaCr = Pcr / A
    expect(r.sigmaCr).toBeCloseTo(expectedPcr / A, -2);
  });

  it("fixed-free (K=2) quarters Pcr compared to pinned-pinned", () => {
    const E = 1000;
    const I = 16;
    const A = 4;
    const L = 10;

    const pinned = columnAnalysis({ E, I, A, L, K: 1 });
    const cantilever = columnAnalysis({ E, I, A, L, K: 2 });

    // Le doubles
    expect(cantilever.Le).toBeCloseTo(2 * pinned.Le, 6);

    // Pcr = π² E I / (Le)²  →  doubling Le divides Pcr by 4
    expect(cantilever.Pcr).toBeCloseTo(pinned.Pcr / 4, 6);

    // sigmaCr follows Pcr
    expect(cantilever.sigmaCr).toBeCloseTo(pinned.sigmaCr / 4, 6);

    // slenderness doubles
    expect(cantilever.slenderness).toBeCloseTo(2 * pinned.slenderness, 6);
  });

  it("slenderness ratio matches hand calculation", () => {
    // r = √(I/A) = √(100 / 25) = √4 = 2
    // L=20, K=0.5 → Le=10, λ = 10/2 = 5
    const r = columnAnalysis({
      E: 1000,
      I: 100,
      A: 25,
      L: 20,
      K: 0.5,
    });

    expect(r.r).toBeCloseTo(2, 6);
    expect(r.Le).toBeCloseTo(10, 6);
    expect(r.slenderness).toBeCloseTo(5, 6);
    expect(r.Pcr).toBeCloseTo((Math.PI ** 2 * 1000 * 100) / 100, 6);
  });

  it("handles degenerate inputs without throwing", () => {
    const z = columnAnalysis({ E: 0, I: 0, A: 0, L: 0, K: 1 });
    expect(z.Le).toBe(0);
    expect(z.r).toBe(0);
    expect(z.slenderness).toBe(0);
    expect(z.Pcr).toBe(0);
    expect(z.sigmaCr).toBe(0);
  });
});

describe("transitionSlenderness", () => {
  it("returns π·√(E/σY)", () => {
    const ts = transitionSlenderness(200000, 250);
    const expected = Math.PI * Math.sqrt(200000 / 250); // ≈ 88.86
    expect(ts).toBeCloseTo(expected, 2);
  });

  it("returns Infinity when σY ≤ 0", () => {
    expect(transitionSlenderness(200000, 0)).toBe(Infinity);
    expect(transitionSlenderness(200000, -10)).toBe(Infinity);
  });
});

describe("eulerCurve", () => {
  it("generates a monotonic decreasing hyperbola", () => {
    const pts = eulerCurve(200000, 50, 200);
    expect(pts.length).toBeGreaterThan(0);

    // First point should be at lowest slenderness → highest stress
    const first = pts[0];
    expect(first.slenderness).toBeGreaterThanOrEqual(50);
    expect(first.sigmaCr).toBeGreaterThan(0);

    // Last point
    const last = pts[pts.length - 1];
    expect(last.slenderness).toBeLessThanOrEqual(200);
    expect(last.sigmaCr).toBeLessThan(first.sigmaCr);
  });

  it("returns empty array when E ≤ 0", () => {
    expect(eulerCurve(0, 0, 100)).toEqual([]);
    expect(eulerCurve(-100, 0, 100)).toEqual([]);
  });
});
