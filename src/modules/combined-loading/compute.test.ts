import { describe, it, expect } from "vitest";
import { combinedLoadingAnalysis, type CombinedLoadingInput } from "./compute";

describe("combinedLoadingAnalysis", () => {
  it("torsion only — solid shaft in pure shear (τ = 16T/πd³, σ1 = −σ2 = τ)", () => {
    // Solid d = 100, T = 1e6, P = M = 0.
    // τ = 16·T / (π·d³) = 16·1e6 / (π·100³) = 16e6 / (π·1e6) = 16/π ≈ 5.09296
    // Pure shear: σx = 0, σy = 0, τxy = τ → σ1 = τ, σ2 = −τ, θp = 45°
    const input: CombinedLoadingInput = {
      shape: "solid",
      do: 100,
      di: 0,
      P: 0,
      T: 1e6,
      M: 0,
    };
    const r = combinedLoadingAnalysis(input);

    const tauExpected = (16 * 1e6) / (Math.PI * 100 ** 3);
    expect(r.tauTorsion).toBeCloseTo(tauExpected, 6);
    expect(r.sigmaAxial).toBe(0);
    expect(r.sigmaBend).toBe(0);
    expect(r.sx).toBe(0);
    expect(r.sigma1).toBeCloseTo(tauExpected, 6);
    expect(r.sigma2).toBeCloseTo(-tauExpected, 6);
    expect(r.tauMaxInPlane).toBeCloseTo(tauExpected, 6);
    expect(r.tauMaxAbsolute).toBeCloseTo(tauExpected, 6);
    expect(r.thetaPdeg).toBeCloseTo(45, 6);
  });

  it("axial only — uniaxial stress (σ1 = P/A, σ2 = 0)", () => {
    // Solid d = 100, P = 1e5, T = M = 0.
    // A = π/4·100² = 7853.9816, σ_axial = P/A ≈ 12.7324
    const input: CombinedLoadingInput = {
      shape: "solid",
      do: 100,
      di: 0,
      P: 1e5,
      T: 0,
      M: 0,
    };
    const r = combinedLoadingAnalysis(input);

    const A = (Math.PI / 4) * 100 ** 2;
    const sigmaExpected = 1e5 / A;
    expect(r.A).toBeCloseTo(A, 6);
    expect(r.sigmaAxial).toBeCloseTo(sigmaExpected, 6);
    expect(r.sigma1).toBeCloseTo(sigmaExpected, 6);
    expect(r.sigma2).toBeCloseTo(0, 6);
    expect(r.tauTorsion).toBe(0);
    expect(r.thetaPdeg).toBeCloseTo(0, 6);
  });

  it("bending only — extreme-fiber stress (σ1 = 32M/πd³, σ2 = 0)", () => {
    // Solid d = 100, M = 1e6, P = T = 0.
    // σ_bend = 32·M / (π·d³) = 32e6 / (π·1e6) = 32/π ≈ 10.18592
    const input: CombinedLoadingInput = {
      shape: "solid",
      do: 100,
      di: 0,
      P: 0,
      T: 0,
      M: 1e6,
    };
    const r = combinedLoadingAnalysis(input);

    const sigmaExpected = (32 * 1e6) / (Math.PI * 100 ** 3);
    expect(r.sigmaBend).toBeCloseTo(sigmaExpected, 6);
    expect(r.sigma1).toBeCloseTo(sigmaExpected, 6);
    expect(r.sigma2).toBeCloseTo(0, 6);
  });

  it("full combined case — solid shaft under P + T + M (hand-checked)", () => {
    // Solid d = 60, P = 50000 (tension), T = 2e6, M = 1.5e6.
    //
    // A = π/4·60²         = 2827.4334
    // I = π/64·60⁴        = 636172.5124
    // J = 2·I              = 1272345.0247
    // c = 30
    //
    // σ_axial = P/A        = 50000/2827.4334        ≈ 17.68388
    // σ_bend  = M·c/I       = 1.5e6·30/636172.5124   ≈ 70.73553
    // τ_tors  = T·c/J       = 2e6·30/1272345.0247    ≈ 47.15702
    //
    // sx = σ_axial + σ_bend ≈ 88.41941, sy = 0, txy ≈ 47.15702
    // center = sx/2         ≈ 44.20971
    // radius = √(center² + txy²) ≈ 64.63964
    // σ1 = center + radius  ≈ 108.84934
    // σ2 = center − radius  ≈ −20.42993
    // τ_max,abs = max(|σ1−σ2|, |σ1|, |σ2|)/2 ≈ 64.63964  (same as in-plane: σ2 < 0 < σ1)
    // θp = ½·atan2(2·txy, sx) in degrees ≈ 23.42381
    const input: CombinedLoadingInput = {
      shape: "solid",
      do: 60,
      di: 0,
      P: 50000,
      T: 2e6,
      M: 1.5e6,
    };
    const r = combinedLoadingAnalysis(input);

    expect(r.A).toBeCloseTo(2827.4334, 3);
    expect(r.I).toBeCloseTo(636172.5124, 2);
    expect(r.J).toBeCloseTo(1272345.0247, 2);
    expect(r.c).toBe(30);
    expect(r.sigmaAxial).toBeCloseTo(17.68388, 4);
    expect(r.sigmaBend).toBeCloseTo(70.73553, 4);
    expect(r.tauTorsion).toBeCloseTo(47.15702, 4);
    expect(r.sx).toBeCloseTo(88.41941, 4);
    expect(r.sigma1).toBeCloseTo(108.84934, 3);
    expect(r.sigma2).toBeCloseTo(-20.42993, 3);
    expect(r.tauMaxInPlane).toBeCloseTo(64.63964, 3);
    expect(r.tauMaxAbsolute).toBeCloseTo(64.63964, 3);
    expect(r.thetaPdeg).toBeCloseTo(23.42381, 3);
  });

  it("hollow shaft under combined loading", () => {
    // Hollow do = 60, di = 40, P = 20000, T = 1e6, M = 5e5.
    // A = π/4·(60²−40²)   = 1570.7963
    // I = π/64·(60⁴−40⁴)  = 510508.8062
    // J = 2·I               = 1021017.6124
    // c = 30
    // σ_axial ≈ 12.73240, σ_bend ≈ 29.38245, τ_tors ≈ 29.38245
    // sx ≈ 42.11485, center ≈ 21.05742, radius ≈ 36.14891
    // σ1 ≈ 57.20633, σ2 ≈ −15.09148
    const input: CombinedLoadingInput = {
      shape: "hollow",
      do: 60,
      di: 40,
      P: 20000,
      T: 1e6,
      M: 5e5,
    };
    const r = combinedLoadingAnalysis(input);

    expect(r.A).toBeCloseTo(1570.7963, 3);
    expect(r.I).toBeCloseTo(510508.8062, 2);
    expect(r.J).toBeCloseTo(1021017.6124, 2);
    expect(r.sigmaAxial).toBeCloseTo(12.73240, 4);
    expect(r.sigmaBend).toBeCloseTo(29.38245, 4);
    expect(r.tauTorsion).toBeCloseTo(29.38245, 4);
    expect(r.sigma1).toBeCloseTo(57.20633, 3);
    expect(r.sigma2).toBeCloseTo(-15.09148, 3);
    expect(r.tauMaxInPlane).toBeCloseTo(36.14891, 3);
  });

  it("a 'solid' shape ignores any di passed in — same result as di: 0", () => {
    const withDi: CombinedLoadingInput = {
      shape: "solid",
      do: 60,
      di: 40, // should be ignored entirely for a solid shaft
      P: 50000,
      T: 2e6,
      M: 1.5e6,
    };
    const withoutDi: CombinedLoadingInput = { ...withDi, di: 0 };

    expect(combinedLoadingAnalysis(withDi)).toEqual(
      combinedLoadingAnalysis(withoutDi),
    );
  });

  it("throws on non-positive outer diameter", () => {
    expect(() =>
      combinedLoadingAnalysis({ shape: "solid", do: 0, di: 0, P: 0, T: 0, M: 0 }),
    ).toThrow("Outer diameter must be positive");

    expect(() =>
      combinedLoadingAnalysis({ shape: "solid", do: -10, di: 0, P: 0, T: 0, M: 0 }),
    ).toThrow("Outer diameter must be positive");
  });

  it("throws on invalid hollow geometry (negative or too-large inner diameter)", () => {
    expect(() =>
      combinedLoadingAnalysis({
        shape: "hollow",
        do: 60,
        di: -5,
        P: 0,
        T: 0,
        M: 0,
      }),
    ).toThrow("Inner diameter must be non-negative");

    expect(() =>
      combinedLoadingAnalysis({
        shape: "hollow",
        do: 60,
        di: 60,
        P: 0,
        T: 0,
        M: 0,
      }),
    ).toThrow("less than outer diameter");

    expect(() =>
      combinedLoadingAnalysis({
        shape: "hollow",
        do: 60,
        di: 90,
        P: 0,
        T: 0,
        M: 0,
      }),
    ).toThrow("less than outer diameter");
  });

  it("no-load case degenerates cleanly (zero stresses, θp = 0)", () => {
    const r = combinedLoadingAnalysis({
      shape: "solid",
      do: 40,
      di: 0,
      P: 0,
      T: 0,
      M: 0,
    });
    expect(r.sigma1).toBe(0);
    expect(r.sigma2).toBe(0);
    expect(r.tauMaxInPlane).toBe(0);
    expect(r.tauMaxAbsolute).toBe(0);
    expect(r.thetaPdeg).toBe(0);
  });
});
