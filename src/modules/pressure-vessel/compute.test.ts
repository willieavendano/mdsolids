import { describe, it, expect } from "vitest";
import { vesselAnalysis, type VesselInput } from "./compute";

describe("vesselAnalysis — cylinder", () => {
  it("computes hoop and longitudinal stress for a thin-walled cylinder", () => {
    const input: VesselInput = { p: 2, r: 10, t: 0.5, type: "cylinder" };
    const res = vesselAnalysis(input);

    // r/t = 10 / 0.5 = 20 ≥ 10 → thin-wall valid
    expect(res.thinWallValid).toBe(true);
    expect(res.ratioRT).toBeCloseTo(20, 4);

    // σ_h = p·r / t = 2·10 / 0.5 = 40
    expect(res.hoop).toBeCloseTo(40, 4);

    // σ_l = p·r / (2t) = 2·10 / 1 = 20
    expect(res.longitudinal).toBeCloseTo(20, 4);

    // τ_max,ip = (σ_h − σ_l)/2 = (40 − 20)/2 = 10
    expect(res.maxInPlaneShear).toBeCloseTo(10, 4);

    // τ_max,abs = σ_h / 2 = 20
    expect(res.absMaxShear).toBeCloseTo(20, 4);
  });

  it("handles a different cylinder case with hand-checkable numbers", () => {
    const input: VesselInput = { p: 5, r: 20, t: 1, type: "cylinder" };
    const res = vesselAnalysis(input);

    // r/t = 20 ≥ 10
    expect(res.thinWallValid).toBe(true);

    // σ_h = 5·20 / 1 = 100
    expect(res.hoop).toBeCloseTo(100, 4);

    // σ_l = 5·20 / 2 = 50
    expect(res.longitudinal).toBeCloseTo(50, 4);

    // τ_max,ip = (100 − 50)/2 = 25
    expect(res.maxInPlaneShear).toBeCloseTo(25, 4);

    // τ_max,abs = 100 / 2 = 50
    expect(res.absMaxShear).toBeCloseTo(50, 4);
  });
});

describe("vesselAnalysis — sphere", () => {
  it("computes equal biaxial stress for a thin-walled sphere", () => {
    const input: VesselInput = { p: 2, r: 10, t: 0.5, type: "sphere" };
    const res = vesselAnalysis(input);

    // r/t = 20 ≥ 10
    expect(res.thinWallValid).toBe(true);

    // σ = p·r / (2t) = 2·10 / 1 = 20
    expect(res.hoop).toBeCloseTo(20, 4);
    expect(res.longitudinal).toBeCloseTo(20, 4);

    // Equal biaxial → no in-plane shear
    expect(res.maxInPlaneShear).toBeCloseTo(0, 4);

    // τ_max,abs = σ/2 = 10
    expect(res.absMaxShear).toBeCloseTo(10, 4);
  });
});

describe("vesselAnalysis — thin-wall validity", () => {
  it("flags invalid when r/t < 10", () => {
    const input: VesselInput = { p: 5, r: 3, t: 1, type: "cylinder" };
    const res = vesselAnalysis(input);

    // r/t = 3 < 10
    expect(res.thinWallValid).toBe(false);
    expect(res.ratioRT).toBeCloseTo(3, 4);

    // Still computes stresses (caller decides how to handle)
    expect(res.hoop).toBeCloseTo(15, 4);
    expect(res.longitudinal).toBeCloseTo(7.5, 4);
  });
});

describe("vesselAnalysis — invalid inputs", () => {
  it("returns zero stresses for r ≤ 0", () => {
    const input: VesselInput = { p: 10, r: 0, t: 0.5, type: "cylinder" };
    const res = vesselAnalysis(input);

    expect(res.hoop).toBe(0);
    expect(res.longitudinal).toBe(0);
    expect(res.maxInPlaneShear).toBe(0);
    expect(res.absMaxShear).toBe(0);
    expect(res.ratioRT).toBe(0);
    expect(res.thinWallValid).toBe(false);
  });

  it("returns zero stresses for t ≤ 0", () => {
    const input: VesselInput = { p: 10, r: 10, t: 0, type: "sphere" };
    const res = vesselAnalysis(input);

    expect(res.hoop).toBe(0);
    expect(res.longitudinal).toBe(0);
    expect(res.thinWallValid).toBe(false);
  });

  it("returns zero stresses for negative t", () => {
    const input: VesselInput = { p: 10, r: 10, t: -0.5, type: "cylinder" };
    const res = vesselAnalysis(input);

    expect(res.hoop).toBe(0);
    expect(res.longitudinal).toBe(0);
    expect(res.thinWallValid).toBe(false);
  });
});
