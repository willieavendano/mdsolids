import { describe, it, expect } from "vitest";
import { torsionAnalysis, type SegmentInput } from "./compute";

describe("torsionAnalysis", () => {
  it("solid circular shaft — single segment", () => {
    // d = 4, L = 10, G = 1, T = 100
    // J   = π·4⁴ / 32    = π·256 / 32  = 8π           ≈ 25.1327  len⁴
    // τ   = T·r / J      = 100·2 / 8π  = 25/π         ≈  7.9577  force/len²
    // φ   = T·L / (J·G)  = 1000 / 8π   = 125/π        ≈ 39.7887  rad
    // φ°  = φ·180/π      = 125·180/π²                 ≈ 2279.7   deg
    const segs: SegmentInput[] = [
      { L: 10, G: 1, do: 4, di: 0, T: 100 },
    ];
    const r = torsionAnalysis(segs);

    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].J).toBeCloseTo(25.1327, 2);
    expect(r.segments[0].Tinternal).toBe(100);
    expect(r.segments[0].tauMax).toBeCloseTo(7.9577, 2);
    expect(r.segments[0].phi).toBeCloseTo(39.7887, 2);

    expect(r.twists).toHaveLength(2);
    expect(r.twists[0]).toBe(0);
    expect(r.twists[1]).toBeCloseTo(39.7887, 2);

    expect(r.totalTwistRad).toBeCloseTo(39.7887, 2);
    // degrees: 39.7887 * 180 / π ≈ 2279.7
    expect(r.totalTwistDeg).toBeCloseTo(2279.7, 1);
  });

  it("hollow circular shaft", () => {
    // do = 4, di = 2, L = 10, G = 1, T = 100
    // J   = π·(4⁴−2⁴) / 32 = π·(256−16) / 32 = π·240/32 = 7.5π  ≈ 23.5619
    // τ   = 100·2 / 7.5π   = 200 / 7.5π                          ≈  8.4883
    // φ   = 100·10 / 7.5π  = 1000 / 7.5π                         ≈ 42.441
    const segs: SegmentInput[] = [
      { L: 10, G: 1, do: 4, di: 2, T: 100 },
    ];
    const r = torsionAnalysis(segs);

    expect(r.segments[0].J).toBeCloseTo(23.5619, 2);
    expect(r.segments[0].Tinternal).toBe(100);
    expect(r.segments[0].tauMax).toBeCloseTo(8.4883, 2);
    expect(r.segments[0].phi).toBeCloseTo(42.441, 2);
  });

  it("two segments in series — internal torque accumulation", () => {
    // Segment 1 (near fixed end): solid d=4, L=5, G=1, T=50 at node 1
    // Segment 2 (free end):      solid d=2, L=5, G=1, T=30 at node 2
    //
    // Internal torques: T₁ = 50+30 = 80,  T₂ = 30
    //
    // Segment 1: J₁ = 8π ≈ 25.133
    //   τ₁ = 80·2 / 8π        = 20/π   ≈ 6.3662
    //   φ₁ = 80·5 / (8π·1)    = 50/π   ≈ 15.9155
    //
    // Segment 2: J₂ = π·2⁴/32 = π/2    ≈ 1.5708
    //   τ₂ = 30·1 / (π/2)     = 60/π   ≈ 19.0986
    //   φ₂ = 30·5 / (π/2)     = 300/π  ≈ 95.4930
    //
    // Total φ = 350/π ≈ 111.4085 rad
    const segs: SegmentInput[] = [
      { L: 5, G: 1, do: 4, di: 0, T: 50 },
      { L: 5, G: 1, do: 2, di: 0, T: 30 },
    ];
    const r = torsionAnalysis(segs);

    expect(r.segments).toHaveLength(2);

    // Internal torques
    expect(r.segments[0].Tinternal).toBe(80);
    expect(r.segments[1].Tinternal).toBe(30);

    // Segment 1
    expect(r.segments[0].J).toBeCloseTo(25.1327, 2);
    expect(r.segments[0].tauMax).toBeCloseTo(6.3662, 2);
    expect(r.segments[0].phi).toBeCloseTo(15.9155, 2);

    // Segment 2
    expect(r.segments[1].J).toBeCloseTo(1.5708, 2);
    expect(r.segments[1].tauMax).toBeCloseTo(19.0986, 2);
    expect(r.segments[1].phi).toBeCloseTo(95.493, 1);

    // Cumulative twists
    expect(r.twists).toHaveLength(3);
    expect(r.twists[0]).toBe(0);
    expect(r.twists[1]).toBeCloseTo(15.9155, 2);
    expect(r.twists[2]).toBeCloseTo(111.4085, 2);

    expect(r.totalTwistRad).toBeCloseTo(111.4085, 2);
  });

  it("negative torque reverses sign of tau and phi", () => {
    // Same as test 1 but T = −100
    // J = 8π, Tinternal = −100
    // tauMax = −100·2 / 8π = −7.9577
    // phi = −1000 / 8π     = −39.7887
    const segs: SegmentInput[] = [
      { L: 10, G: 1, do: 4, di: 0, T: -100 },
    ];
    const r = torsionAnalysis(segs);

    expect(r.segments[0].Tinternal).toBe(-100);
    expect(r.segments[0].tauMax).toBeCloseTo(-7.9577, 2);
    expect(r.segments[0].phi).toBeCloseTo(-39.7887, 2);
    expect(r.totalTwistRad).toBeCloseTo(-39.7887, 2);
  });

  it("throws on invalid geometry", () => {
    // Non-positive length
    expect(() =>
      torsionAnalysis([{ L: 0, G: 1, do: 4, di: 0, T: 100 }]),
    ).toThrow("length must be positive");

    // Non-positive shear modulus
    expect(() =>
      torsionAnalysis([{ L: 10, G: 0, do: 4, di: 0, T: 100 }]),
    ).toThrow("shear modulus must be positive");

    // Non-positive outer diameter
    expect(() =>
      torsionAnalysis([{ L: 10, G: 1, do: -1, di: 0, T: 100 }]),
    ).toThrow("outer diameter must be positive");

    // Negative inner diameter
    expect(() =>
      torsionAnalysis([{ L: 10, G: 1, do: 4, di: -2, T: 100 }]),
    ).toThrow("inner diameter must be non-negative");

    // di == do
    expect(() =>
      torsionAnalysis([{ L: 10, G: 1, do: 4, di: 4, T: 100 }]),
    ).toThrow("less than outer diameter");

    // di > do
    expect(() =>
      torsionAnalysis([{ L: 10, G: 1, do: 4, di: 5, T: 100 }]),
    ).toThrow("less than outer diameter");
  });

  it("empty segments array returns zero results", () => {
    const r = torsionAnalysis([]);
    expect(r.segments).toEqual([]);
    expect(r.twists).toEqual([0]);
    expect(r.totalTwistRad).toBe(0);
    expect(r.totalTwistDeg).toBe(0);
  });

  it("three segments — torques partially cancel", () => {
    // Segment 1: d=4, L=3, G=1,  T=+100 at node 1
    // Segment 2: d=3, L=4, G=2,  T=−60  at node 2
    // Segment 3: d=2, L=5, G=1,  T=+20  at node 3
    //
    // Internal torques:
    //   T₃ = 20
    //   T₂ = −60 + 20 = −40
    //   T₁ = 100 − 60 + 20 = 60
    //
    // Segment 1: J₁ = π·256/32 = 8π
    //   τ₁ = 60·2 / 8π         = 15/π    ≈ 4.7746
    //   φ₁ = 60·3 / (8π·1)     = 22.5/π  ≈ 7.1620
    //
    // Segment 2: J₂ = π·81/32  ≈ 7.9522
    //   τ₂ = −40·1.5 / 7.9522  ≈ −7.545
    //   φ₂ = −40·4 / (7.9522·2) ≈ −10.060  (harder to hand-check, use closeTo)
    //
    // Segment 3: J₃ = π·16/32 = π/2 ≈ 1.5708
    //   τ₃ = 20·1 / 1.5708     ≈ 12.732
    //   φ₃ = 20·5 / (1.5708·1) ≈ 63.662
    const segs: SegmentInput[] = [
      { L: 3, G: 1, do: 4, di: 0, T: 100 },
      { L: 4, G: 2, do: 3, di: 0, T: -60 },
      { L: 5, G: 1, do: 2, di: 0, T: 20 },
    ];
    const r = torsionAnalysis(segs);

    expect(r.segments).toHaveLength(3);
    expect(r.segments[0].Tinternal).toBe(60);
    expect(r.segments[1].Tinternal).toBe(-40);
    expect(r.segments[2].Tinternal).toBe(20);

    expect(r.segments[0].tauMax).toBeCloseTo(4.7746, 2);
    expect(r.segments[2].tauMax).toBeCloseTo(12.732, 1);

    // Sanity: cumulative twist should equal sum of segment phis
    const sumPhi = r.segments.reduce((a, s) => a + s.phi, 0);
    expect(r.totalTwistRad).toBeCloseTo(sumPhi, 6);
    expect(r.twists[r.twists.length - 1]).toBeCloseTo(r.totalTwistRad, 6);
  });
});
