/**
 * Beam Deflection — elastic curve v(x) for simply-supported and cantilever
 * beams under point loads and uniform distributed loads (UDLs).
 *
 * Sign convention:
 *   Loads (point P, distributed w)  — DOWNWARD positive.
 *   Bending moment M(x)             — SAGGING positive: moment of the forces
 *                                       to the LEFT of the cut (same
 *                                       convention as the beam/compute.ts
 *                                       shear-moment module — downward loads
 *                                       give a positive, sagging M).
 *   Deflection v(x)                 — DOWNWARD positive. A beam that sags
 *                                       under its loads reports v > 0.
 *
 * The Euler-Bernoulli curvature relation with y measured UPWARD positive is
 * the familiar  EI y''(x) = M(x)  (sagging-positive convention). Since our
 * v is measured downward (v = -y), this becomes:
 *
 *      EI v''(x) = -M(x)      i.e.      v''(x) = -M(x) / (E I)
 *
 * v(x) is obtained by integrating the curvature twice with cumulative
 * trapezoidal quadrature on a uniform grid, then fixing the two constants
 * of integration (slope and deflection at x = 0) from the boundary
 * conditions of the support:
 *   simple:     v(0) = 0, v(L) = 0
 *   cantilever: v(0) = 0, v'(0) = 0   (fixed at x = 0, free at x = L)
 */

export type SupportType = "simple" | "cantilever";

export interface PointLoadInput {
  /** Position along the beam, 0 ≤ x ≤ L. */
  x: number;
  /** Downward force magnitude. */
  P: number;
}

export interface UDLInput {
  /** Start position, 0 ≤ x1 < x2 ≤ L. */
  x1: number;
  x2: number;
  /** Downward force per unit length. */
  w: number;
}

export interface BeamDeflectionInput {
  /** Elastic modulus. */
  E: number;
  /** Second moment of area. */
  I: number;
  /** Span length. */
  L: number;
  /** "simple" = pin at x=0, roller at x=L. "cantilever" = fixed at x=0, free at x=L. */
  support: SupportType;
  pointLoads: PointLoadInput[];
  udls: UDLInput[];
}

export interface BeamDeflectionReactions {
  /** Simply-supported: upward reactions at the left/right supports. */
  Ra?: number;
  Rb?: number;
  /** Cantilever: upward reaction and CCW reaction moment at the fixed end. */
  R?: number;
  Mr?: number;
}

export interface BeamDeflectionResult {
  /** Uniform grid positions, length >= 2001. */
  x: number[];
  /** Deflection at each grid point, downward positive. */
  v: number[];
  /** Slope dv/dx at each grid point. */
  slope: number[];
  /** Point of largest-magnitude deflection. */
  maxDeflection: { x: number; v: number };
  reactions: BeamDeflectionReactions;
}

/** Grid resolution — comfortably above the >= 2001 contract minimum, and an
 *  even number of intervals so exact-half-span features (midspan point
 *  loads, symmetric spans) land on a grid node instead of being interpolated. */
const GRID_POINTS = 4001;

export function analyzeBeamDeflection(
  input: BeamDeflectionInput,
): BeamDeflectionResult {
  const { E, I, L, support, pointLoads, udls } = input;

  // ---- guards --------------------------------------------------------------
  if (!Number.isFinite(L) || L <= 0) {
    throw new Error("Beam length L must be a positive number.");
  }
  if (!Number.isFinite(E) || E <= 0) {
    throw new Error("Modulus E must be a positive number.");
  }
  if (!Number.isFinite(I) || I <= 0) {
    throw new Error("Moment of inertia I must be a positive number.");
  }
  if (support !== "simple" && support !== "cantilever") {
    throw new Error(`Unknown support type "${String(support)}".`);
  }
  const EI = E * I;
  if (!Number.isFinite(EI) || EI <= 0) {
    throw new Error("EI must be positive.");
  }
  for (const pl of pointLoads) {
    if (!Number.isFinite(pl.x) || !Number.isFinite(pl.P)) {
      throw new Error("Point loads must have finite x and P values.");
    }
    if (pl.x < 0 || pl.x > L) {
      throw new Error(
        `Point load at x=${pl.x} is outside the beam span [0, ${L}].`,
      );
    }
  }
  for (const ud of udls) {
    if (![ud.x1, ud.x2, ud.w].every((n) => Number.isFinite(n))) {
      throw new Error("UDLs must have finite x1, x2 and w values.");
    }
    if (ud.x1 < 0 || ud.x2 > L || ud.x1 >= ud.x2) {
      throw new Error(
        `UDL span [${ud.x1}, ${ud.x2}] is invalid or outside the beam span [0, ${L}].`,
      );
    }
  }

  // ---- reactions -------------------------------------------------------------
  // W = total downward load; sumM0 = clockwise moment of all loads about x=0.
  let W = 0;
  let sumM0 = 0;
  for (const pl of pointLoads) {
    W += pl.P;
    sumM0 += pl.P * pl.x;
  }
  for (const ud of udls) {
    const len = ud.x2 - ud.x1;
    const force = ud.w * len;
    W += force;
    sumM0 += (force * (ud.x1 + ud.x2)) / 2;
  }

  const reactions: BeamDeflectionReactions = {};
  // R0 = upward reaction acting at x=0 for both support types (Ra / R).
  // M0 = CCW reaction moment acting at x=0 (cantilever only; 0 for simple).
  let R0 = 0;
  let M0 = 0;
  if (support === "simple") {
    const Rb = sumM0 / L;
    R0 = W - Rb;
    reactions.Ra = R0;
    reactions.Rb = Rb;
  } else {
    R0 = W;
    M0 = sumM0;
    reactions.R = R0;
    reactions.Mr = M0;
  }

  // ---- M(x): sagging-positive moment of forces to the LEFT of the cut --------
  function momentAt(x: number): number {
    let M = R0 * x;
    if (support === "cantilever") M -= M0; // CCW reaction moment decreases M

    for (const pl of pointLoads) {
      if (pl.x < x) M -= pl.P * (x - pl.x);
    }
    for (const ud of udls) {
      if (ud.x1 < x) {
        const partialEnd = Math.min(x, ud.x2);
        const partialLen = partialEnd - ud.x1;
        if (partialLen > 0) {
          const force = ud.w * partialLen;
          const centroid = ud.x1 + partialLen / 2;
          M -= force * (x - centroid);
        }
      }
    }
    return M;
  }

  // ---- uniform grid + curvature v''(x) = -M(x)/EI ----------------------------
  const n = GRID_POINTS;
  const dx = L / (n - 1);
  const x: number[] = new Array(n);
  const curvature: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const xi = i === n - 1 ? L : i * dx; // avoid float drift at the tip
    x[i] = xi;
    curvature[i] = -momentAt(xi) / EI;
  }

  // ---- integrate twice (cumulative trapezoidal), starting from zero ----------
  // rawSlope/rawV assume both integration constants are zero; the true
  // constants are fixed afterward from the boundary conditions.
  const rawSlope: number[] = new Array(n);
  rawSlope[0] = 0;
  for (let i = 1; i < n; i++) {
    rawSlope[i] =
      rawSlope[i - 1] + ((curvature[i - 1] + curvature[i]) / 2) * (x[i] - x[i - 1]);
  }

  const rawV: number[] = new Array(n);
  rawV[0] = 0;
  for (let i = 1; i < n; i++) {
    rawV[i] =
      rawV[i - 1] + ((rawSlope[i - 1] + rawSlope[i]) / 2) * (x[i] - x[i - 1]);
  }

  // ---- apply boundary conditions ----------------------------------------------
  // v(0) = 0 always (both support types) → the deflection integration
  // constant C2 is zero. The slope integration constant C1 = v'(0):
  //   cantilever: C1 = 0 (fixed end — zero slope)
  //   simple:     C1 chosen so that v(L) = 0
  const C1 = support === "simple" ? -rawV[n - 1] / L : 0;

  const v: number[] = new Array(n);
  const slope: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    slope[i] = rawSlope[i] + C1;
    v[i] = rawV[i] + C1 * x[i];
  }

  // ---- point of largest-magnitude deflection ----------------------------------
  let maxIdx = 0;
  for (let i = 1; i < n; i++) {
    if (Math.abs(v[i]) > Math.abs(v[maxIdx])) maxIdx = i;
  }

  return {
    x,
    v,
    slope,
    maxDeflection: { x: x[maxIdx], v: v[maxIdx] },
    reactions,
  };
}
