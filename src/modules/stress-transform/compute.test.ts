import { describe, it, expect } from "vitest";
import { transform, principal, type StressState } from "./compute";

// ── transform ─────────────────────────────────────────────────────────

describe("transform", () => {
  it("returns input stresses when theta = 0°", () => {
    const s: StressState = { sx: 50, sy: 10, txy: 20 };
    const r = transform(s, 0);
    expect(r.sxp).toBeCloseTo(50);
    expect(r.syp).toBeCloseTo(10);
    expect(r.txyp).toBeCloseTo(20);
  });

  it("swaps axes at 90° for uniaxial stress (σ_x'=σ_y, σ_y'=σ_x, τ=0)", () => {
    const s: StressState = { sx: 100, sy: 0, txy: 0 };
    const r = transform(s, 90);
    expect(r.sxp).toBeCloseTo(0);
    expect(r.syp).toBeCloseTo(100);
    expect(r.txyp).toBeCloseTo(0);
  });

  it("returns original stresses after full 180° rotation", () => {
    const s: StressState = { sx: 80, sy: 20, txy: 30 };
    const r = transform(s, 180);
    expect(r.sxp).toBeCloseTo(s.sx);
    expect(r.syp).toBeCloseTo(s.sy);
    expect(r.txyp).toBeCloseTo(s.txy);
  });

  it("preserves the stress invariant σ_x' + σ_y' = σ_x + σ_y at any angle", () => {
    const s: StressState = { sx: 80, sy: 20, txy: 30 };
    for (const deg of [0, 15, 30, 45, 60, 90, 120, 135, 180]) {
      const r = transform(s, deg);
      expect(r.sxp + r.syp).toBeCloseTo(s.sx + s.sy);
    }
  });

  it("handles pure shear: sx=0, sy=0, txy=10 at 45° yields σ_x'=10", () => {
    // At 45° CCW, the pure-shear element aligns with principal axes.
    // Formula: sxp = 0 + 0 + 10·sin(90°) = 10
    const s: StressState = { sx: 0, sy: 0, txy: 10 };
    const r = transform(s, 45);
    expect(r.sxp).toBeCloseTo(10);
    expect(r.syp).toBeCloseTo(-10);
    expect(r.txyp).toBeCloseTo(0);
  });
});

// ── principal ─────────────────────────────────────────────────────────

describe("principal", () => {
  it("pure shear: sx=0, sy=0, txy=10 → σ₁=10, σ₂=−10, θₚ=45°", () => {
    const s: StressState = { sx: 0, sy: 0, txy: 10 };
    const p = principal(s);
    expect(p.center).toBeCloseTo(0);
    expect(p.radius).toBeCloseTo(10);
    expect(p.sigma1).toBeCloseTo(10);
    expect(p.sigma2).toBeCloseTo(-10);
    expect(p.thetaPdeg).toBeCloseTo(45);
    expect(p.tauMax).toBeCloseTo(10);
    expect(p.avg).toBeCloseTo(0);
  });

  it("uniaxial tension: sx=20, sy=0, txy=0 → σ₁=20, σ₂=0, θₚ=0°", () => {
    const s: StressState = { sx: 20, sy: 0, txy: 0 };
    const p = principal(s);
    expect(p.sigma1).toBeCloseTo(20);
    expect(p.sigma2).toBeCloseTo(0);
    expect(p.thetaPdeg).toBeCloseTo(0);
    expect(p.tauMax).toBeCloseTo(10); // R = 10
    expect(p.avg).toBeCloseTo(10);
  });

  it("mixed state sx=80, sy=20, txy=30 — hand-checked values", () => {
    // diff = 30, R = √(30² + 30²) = √1800 ≈ 42.426
    // θₚ = ½·atan2(60, 60) = ½·45° = 22.5°
    const s: StressState = { sx: 80, sy: 20, txy: 30 };
    const p = principal(s);
    expect(p.center).toBeCloseTo(50);
    expect(p.radius).toBeCloseTo(Math.sqrt(1800));
    expect(p.sigma1).toBeCloseTo(50 + Math.sqrt(1800)); // ≈ 92.426
    expect(p.sigma2).toBeCloseTo(50 - Math.sqrt(1800)); // ≈  7.574
    expect(p.thetaPdeg).toBeCloseTo(22.5);
    expect(p.tauMax).toBeCloseTo(Math.sqrt(1800));
  });

  it("equal biaxial with no shear degenerates to a point (R=0)", () => {
    const s: StressState = { sx: 50, sy: 50, txy: 0 };
    const p = principal(s);
    expect(p.sigma1).toBeCloseTo(50);
    expect(p.sigma2).toBeCloseTo(50);
    expect(p.radius).toBeCloseTo(0);
    expect(p.tauMax).toBeCloseTo(0);
    expect(p.thetaPdeg).toBeCloseTo(0);
  });

  it("negative shear: sx=30, sy=10, txy=−15 → θₚ should be negative", () => {
    // diff = 10, R = √(10² + 15²) = √325 ≈ 18.028
    // θₚ = ½·atan2(−30, 20) = ½·(−56.31°) = −28.15°
    const s: StressState = { sx: 30, sy: 10, txy: -15 };
    const p = principal(s);
    expect(p.center).toBeCloseTo(20);
    expect(p.radius).toBeCloseTo(Math.sqrt(325));
    expect(p.sigma1).toBeCloseTo(20 + Math.sqrt(325));
    expect(p.sigma2).toBeCloseTo(20 - Math.sqrt(325));
    expect(p.thetaPdeg).toBeCloseTo(-28.155, 1);
  });

  it("σ₁ ≥ σ₂ always (definition of ordering)", () => {
    // Even when sx < sy, sigma1 should still be larger
    const s: StressState = { sx: 10, sy: 50, txy: 20 };
    const p = principal(s);
    expect(p.sigma1).toBeGreaterThanOrEqual(p.sigma2);
  });
});
