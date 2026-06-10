import { describe, it, expect } from "vitest";
import { analyzeBeam } from "./compute";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the sample whose x is closest to `target`. */
function sampleAt(samples: { x: number; V: number; M: number }[], target: number) {
  let best = samples[0];
  let bestD = Math.abs(best.x - target);
  for (const s of samples) {
    const d = Math.abs(s.x - target);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeBeam", () => {
  // -- 1. Simply supported, central point load ----------------------------
  it("simply supported beam with central point load", () => {
    const res = analyzeBeam({
      L: 10,
      type: "simply-supported",
      loads: [{ type: "point", x: 5, P: 100 }],
    });

    // Reactions: Ra = Rb = P/2 = 50
    expect(res.reactions.Ra).toBeCloseTo(50);
    expect(res.reactions.Rb).toBeCloseTo(50);

    // Shear extrema
    expect(res.Vmax).toBeCloseTo(50);
    expect(res.Vmin).toBeCloseTo(-50);
    // Max positive shear (+Ra) holds from the left support through mid-span;
    // its first occurrence is at the support (x ≥ 0). Min shear is just past center.
    expect(res.VmaxLoc).toBeGreaterThanOrEqual(0);
    expect(res.VmaxLoc).toBeLessThan(5);
    expect(res.VminLoc).toBeGreaterThan(5);

    // Mmax = P·L/4 = 100*10/4 = 250 at x = 5
    expect(res.Mmax).toBeCloseTo(250, -1); // within ~10
    expect(res.MmaxLoc).toBeCloseTo(5, 1);

    // Ends: M(0) ≈ 0, M(L) ≈ 0
    expect(sampleAt(res.samples, 0).M).toBeCloseTo(0, 1);
    expect(sampleAt(res.samples, 10).M).toBeCloseTo(0, 1);

    // No warnings
    expect(res.warnings).toHaveLength(0);
  });

  // -- 2. Simply supported, full UDL -------------------------------------
  it("simply supported beam with full UDL", () => {
    const res = analyzeBeam({
      L: 10,
      type: "simply-supported",
      loads: [{ type: "udl", xStart: 0, xEnd: 10, w: 20 }],
    });

    // Total load = 200;  Ra = Rb = 100
    expect(res.reactions.Ra).toBeCloseTo(100);
    expect(res.reactions.Rb).toBeCloseTo(100);

    // Shear extrema
    expect(res.Vmax).toBeCloseTo(100);
    expect(res.Vmin).toBeCloseTo(-100);

    // Mmax = w·L²/8 = 20·100/8 = 250 at centre
    expect(res.Mmax).toBeCloseTo(250, -1);
    expect(res.MmaxLoc).toBeCloseTo(5, 1);

    // Ends
    expect(sampleAt(res.samples, 0).M).toBeCloseTo(0, 1);
    expect(sampleAt(res.samples, 10).M).toBeCloseTo(0, 1);

    expect(res.warnings).toHaveLength(0);
  });

  // -- 3. Cantilever, end point load -------------------------------------
  it("cantilever beam with end point load", () => {
    const res = analyzeBeam({
      L: 10,
      type: "cantilever",
      loads: [{ type: "point", x: 10, P: 50 }],
    });

    // Reaction force R = 50 up; reaction moment Mr = 50·10 = 500
    expect(res.reactions.R).toBeCloseTo(50);
    expect(res.reactions.Mr).toBeCloseTo(500);

    // Shear = 50 throughout
    expect(res.Vmax).toBeCloseTo(50);
    expect(res.Vmin).toBeCloseTo(50); // constant
    expect(sampleAt(res.samples, 5).V).toBeCloseTo(50);

    // Moment at fixed end = –P·L = –500
    expect(res.Mmin).toBeCloseTo(-500, -1);
    // Free end moment ≈ 0
    expect(sampleAt(res.samples, 10).M).toBeCloseTo(0, 1);

    expect(res.warnings).toHaveLength(0);
  });

  // -- 4. Equilibrium: simply supported with mixed loads -----------------
  it("equilibrium — M vanishes at both ends for simply supported", () => {
    const res = analyzeBeam({
      L: 8,
      type: "simply-supported",
      loads: [
        { type: "point",  x: 2, P: 80 },
        { type: "udl",    xStart: 3, xEnd: 7, w: 10 },
        { type: "moment", x: 5, M: 40 },
      ],
    });

    // Hand-check reactions:
    //   W = 80 + 10·4 = 120
    //   Σ M_about_0 = 80·2 + 4·10·5 – 40 = 160+200–40 = 320
    //   Rb = 320/8 = 40,  Ra = 120–40 = 80
    expect(res.reactions.Ra).toBeCloseTo(80);
    expect(res.reactions.Rb).toBeCloseTo(40);

    // Both ends ~ 0 moment
    const m0  = sampleAt(res.samples, 0).M;
    const m8  = sampleAt(res.samples, 8).M;
    expect(m0).toBeCloseTo(0, 0);
    expect(m8).toBeCloseTo(0, 0);

    // No warnings for a healthy input
    expect(res.warnings).toHaveLength(0);
  });

  // -- 5. Applied moment on simply supported beam ------------------------
  it("simply supported beam with pure applied moment", () => {
    const res = analyzeBeam({
      L: 10,
      type: "simply-supported",
      loads: [{ type: "moment", x: 3, M: 60 }],
    });

    // Ra = Mc/L = 6, Rb = –6
    expect(res.reactions.Ra).toBeCloseTo(6);
    expect(res.reactions.Rb).toBeCloseTo(-6);

    // M at ends
    expect(sampleAt(res.samples, 0).M).toBeCloseTo(0, 1);
    expect(sampleAt(res.samples, 10).M).toBeCloseTo(0, 1);

    // M just before the moment at x=3: Ra·3 = 18
    const before = sampleAt(res.samples, 2.99);
    expect(before.M).toBeCloseTo(18, -1);

    // M just after: Ra·3 – 60 = 18 – 60 = –42
    const after = sampleAt(res.samples, 3.01);
    expect(after.M).toBeCloseTo(-42, -1);

    expect(res.warnings).toHaveLength(0);
  });

  // -- 6. Guard: zero-length beam ----------------------------------------
  it("returns warning for zero-length beam", () => {
    const res = analyzeBeam({ L: 0, type: "simply-supported", loads: [] });
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.samples).toHaveLength(0);
  });
});
