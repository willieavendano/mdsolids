import { describe, it, expect } from "vitest";
import { transformStrain, principalStrains, rosette45, rosette60 } from "./compute";

// ── transformStrain ──────────────────────────────────────────────────

describe("transformStrain", () => {
  it("returns the input strains at θ = 0°", () => {
    const r = transformStrain(500, -300, 600, 0);
    expect(r.ex1).toBeCloseTo(500);
    expect(r.ey1).toBeCloseTo(-300);
    expect(r.gx1y1).toBeCloseTo(600);
  });

  it("swaps εx/εy and negates γxy at θ = 90°", () => {
    const r = transformStrain(500, -300, 600, 90);
    expect(r.ex1).toBeCloseTo(-300);
    expect(r.ey1).toBeCloseTo(500);
    expect(r.gx1y1).toBeCloseTo(-600);
  });

  it("preserves the strain invariant εx' + εy' = εx + εy at any angle", () => {
    const ex = 500,
      ey = -300,
      gxy = 600;
    for (const deg of [0, 15, 30, 37, 60, 90, 135, 180]) {
      const r = transformStrain(ex, ey, gxy, deg);
      expect(r.ex1 + r.ey1).toBeCloseTo(ex + ey);
    }
  });

  it("throws on non-finite input", () => {
    expect(() => transformStrain(NaN, -300, 600, 0)).toThrow();
    expect(() => transformStrain(500, -300, 600, Infinity)).toThrow();
  });
});

// ── principalStrains ─────────────────────────────────────────────────

describe("principalStrains", () => {
  // Worked case (hand-checked, με): εx=500, εy=-300, γxy=600
  //   avg  = (500 + -300)/2 = 100
  //   diff = (500 - -300)/2 = 400
  //   γxy/2 = 300
  //   R = sqrt(400^2 + 300^2) = sqrt(160000+90000) = sqrt(250000) = 500
  //   ε1 = 100 + 500 = 600, ε2 = 100 - 500 = -400
  //   γmax = 2*500 = 1000, εavg = 100
  //   θp = 0.5*atan2(600, 800) = 0.5*36.8699° = 18.43495°
  it("matches a hand-checked worked example (εx=500, εy=-300, γxy=600 με)", () => {
    const p = principalStrains(500, -300, 600);
    expect(p.e1).toBeCloseTo(600);
    expect(p.e2).toBeCloseTo(-400);
    expect(p.gammaMax).toBeCloseTo(1000);
    expect(p.eAvg).toBeCloseTo(100);
    expect(p.thetaP).toBeCloseTo(18.43494882, 5);
  });

  it("rotating by θp aligns the element with the principal axes (zero shear, ε=ε1)", () => {
    const p = principalStrains(500, -300, 600);
    const r = transformStrain(500, -300, 600, p.thetaP);
    expect(r.ex1).toBeCloseTo(p.e1);
    expect(r.gx1y1).toBeCloseTo(0);
  });

  it("throws on non-finite input", () => {
    expect(() => principalStrains(NaN, -300, 600)).toThrow();
    expect(() => principalStrains(500, -300, Infinity)).toThrow();
  });
});

// ── rosette45 (rectangular, 0°/45°/90°) ──────────────────────────────

describe("rosette45", () => {
  it("recovers a known strain state from generated gauge readings", () => {
    // Known state: ex=500, ey=-300, gxy=600 (με)
    // ea = ex = 500, ec = ey = -300
    // gxy = 2eb - ea - ec  =>  eb = (gxy + ea + ec)/2 = (600 + 500 - 300)/2 = 400
    const ea = 500,
      eb = 400,
      ec = -300;
    const s = rosette45(ea, eb, ec);
    expect(s.ex).toBeCloseTo(500);
    expect(s.ey).toBeCloseTo(-300);
    expect(s.gxy).toBeCloseTo(600);
  });

  it("throws on non-finite input", () => {
    expect(() => rosette45(NaN, 400, -300)).toThrow();
  });
});

// ── rosette60 (delta, 0°/60°/120°) ───────────────────────────────────

describe("rosette60", () => {
  it("recovers a known strain state from generated gauge readings", () => {
    // Known state: ex=500, ey=-300, gxy=600 (με)
    // ea = ex = 500
    // ey = (2eb+2ec-ea)/3  =>  eb+ec = (3ey+ea)/2 = (3*-300+500)/2 = -200
    // gxy = 2(eb-ec)/√3    =>  eb-ec = gxy*√3/2 = 600*√3/2 ≈ 519.6152423
    // eb ≈ 159.8076211, ec ≈ -359.8076211
    const ea = 500,
      eb = 159.80762113533155,
      ec = -359.80762113533155;
    const s = rosette60(ea, eb, ec);
    expect(s.ex).toBeCloseTo(500, 5);
    expect(s.ey).toBeCloseTo(-300, 5);
    expect(s.gxy).toBeCloseTo(600, 5);
  });

  it("throws on non-finite input", () => {
    expect(() => rosette60(500, NaN, -359.8)).toThrow();
  });
});
