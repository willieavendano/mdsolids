/**
 * Column Buckling — Euler critical load, slenderness, and buckling stress.
 * Pure functions — no DOM. Units are consistent; the caller decides what
 * force, length, and stress units mean.
 */

export const END_CONDITIONS: Record<string, number> = {
  "pinned-pinned": 1.0,
  "fixed-free": 2.0,
  "fixed-fixed": 0.5,
  "fixed-pinned": 0.699,
};

export interface ColumnInput {
  /** Elastic modulus. */
  E: number;
  /** Least moment of inertia of the cross-section. */
  I: number;
  /** Cross-sectional area. */
  A: number;
  /** Column length. */
  L: number;
  /** Effective-length factor K (see END_CONDITIONS). */
  K: number;
}

export interface ColumnResult {
  /** Effective length K·L. */
  Le: number;
  /** Radius of gyration r = √(I/A). */
  r: number;
  /** Slenderness ratio Le / r. */
  slenderness: number;
  /** Euler critical load P_cr = π² E I / Le². */
  Pcr: number;
  /** Critical buckling stress σ_cr = P_cr / A = π² E / λ². */
  sigmaCr: number;
}

export interface EulerCurvePoint {
  slenderness: number;
  sigmaCr: number;
}

/**
 * Full column analysis from input geometry and material.
 * Returns NaN for slenderness / Pcr / sigmaCr when inputs are singular
 * (A ≤ 0, I ≤ 0, Le ≤ 0) — the UI is responsible for guarding display.
 */
export function columnAnalysis(c: ColumnInput): ColumnResult {
  const Le = c.K * c.L;
  const r = c.A > 0 ? Math.sqrt(c.I / c.A) : 0;
  const slenderness = r > 0 ? Le / r : 0;

  const pi2E = Math.PI * Math.PI * c.E;
  const Pcr = Le > 0 ? (pi2E * c.I) / (Le * Le) : 0;
  const sigmaCr = c.A > 0 ? Pcr / c.A : 0;

  return { Le, r, slenderness, Pcr, sigmaCr };
}

/**
 * Transition slenderness — the λ at which σ_cr = σY.
 * λ_trans = π · √(E / σY).
 * If σY ≤ 0 returns Infinity (elastic buckling always governs).
 */
export function transitionSlenderness(E: number, sigmaY: number): number {
  if (sigmaY <= 0 || E <= 0) return Infinity;
  return Math.PI * Math.sqrt(E / sigmaY);
}

/**
 * Generate points for the Euler hyperbola σ = π² E / λ².
 * `rmin` and `rmax` are slenderness-ratio bounds (default gives a usable range).
 * Returns an empty array when E ≤ 0.
 */
export function eulerCurve(
  E: number,
  rmin: number = 0,
  rmax?: number,
): EulerCurvePoint[] {
  if (E <= 0) return [];
  const max = rmax ?? Math.max(rmin * 1.5, 200);
  if (max <= rmin) return [];
  const pts: EulerCurvePoint[] = [];
  const pi2E = Math.PI * Math.PI * E;
  const steps = 200;
  // Sample denser at low slenderness where the curve changes fastest.
  for (let i = 0; i <= steps; i++) {
    // Logarithmic spacing — more points near small λ.
    const t = i / steps;
    const lambda = rmin > 0
      ? rmin * Math.pow(max / rmin, t)
      : t * max + 0.01; // avoid λ=0
    const sigma = pi2E / (lambda * lambda);
    pts.push({ slenderness: lambda, sigmaCr: sigma });
  }
  return pts;
}
