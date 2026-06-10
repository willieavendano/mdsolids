/**
 * Beam Diagrams — pure physics for shear-force & bending-moment diagrams.
 *
 * Supports simply-supported (pin at x=0, roller at x=L) and cantilever
 * (fixed at x=0, free at x=L) beams. Handles point loads, uniform
 * distributed loads, and concentrated applied moments.
 *
 * Sign convention:
 *   Point load P  — downward positive
 *   UDL w          — downward force per length
 *   Applied moment — CCW positive
 *
 * Internal sign convention (V, M):
 *   Shear  V(x) = Σ transverse forces to the LEFT of cut x (upward positive).
 *   Moment M(x) = Σ moments about cut x from forces LEFT of x (sagging positive).
 *   A CCW applied moment at xMi < x **decreases** M by its magnitude.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BeamType = "simply-supported" | "cantilever";

export interface PointLoad {
  type: "point";
  /** Position along the beam (0 ≤ x ≤ L). */
  x: number;
  /** Downward force magnitude. */
  P: number;
}

export interface UDLLoad {
  type: "udl";
  /** Start position of uniform distributed load. */
  xStart: number;
  /** End position (xStart < xEnd ≤ L). */
  xEnd: number;
  /** Downward force per unit length. */
  w: number;
}

export interface MomentLoad {
  type: "moment";
  /** Position along the beam. */
  x: number;
  /** CCW applied moment magnitude. */
  M: number;
}

export type Load = PointLoad | UDLLoad | MomentLoad;

export interface BeamReactions {
  /** Left reaction (simply-supported). */
  Ra?: number;
  /** Right reaction (simply-supported). */
  Rb?: number;
  /** Reaction force at fixed end (cantilever). */
  R?: number;
  /** Reaction moment at fixed end (cantilever). CCW positive. */
  Mr?: number;
}

export interface DiagramSample {
  x: number;
  V: number;
  M: number;
}

export interface BeamResult {
  reactions: BeamReactions;
  samples: DiagramSample[];
  Vmax: number;
  Vmin: number;
  VmaxLoc: number;
  VminLoc: number;
  Mmax: number;
  Mmin: number;
  MmaxLoc: number;
  MminLoc: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------

/**
 * Compute reactions, shear-force and bending-moment diagrams for a beam.
 *
 * Samples at ≥250 equally-spaced points plus exact positions of all loads
 * and just-after positions at point loads / applied moments so jumps are
 * visible in the diagrams.
 */
export function analyzeBeam(params: {
  L: number;
  type: BeamType;
  loads: Load[];
}): BeamResult {
  const { L, type, loads } = params;
  const warnings: string[] = [];

  // Guard: non-positive length
  if (L <= 0) {
    return {
      reactions: {},
      samples: [],
      Vmax: 0, Vmin: 0, VmaxLoc: 0, VminLoc: 0,
      Mmax: 0, Mmin: 0, MmaxLoc: 0, MminLoc: 0,
      warnings: ["Beam length L must be positive."],
    };
  }

  // Normalise UDLs: swap xStart/xEnd when reversed
  const norm: Load[] = loads.map((ld) => {
    if (ld.type === "udl" && ld.xStart > ld.xEnd) {
      warnings.push(
        `UDL xStart (${ld.xStart}) > xEnd (${ld.xEnd}); values swapped.`,
      );
      return { ...ld, xStart: ld.xEnd, xEnd: ld.xStart };
    }
    return ld;
  });

  // ---- global equilibrium ----
  let W = 0;               // total downward load
  let sumMoment0 = 0;      // Σ (clockwise moment of loads about x=0)
                            //   point : P * x
                            //   UDL   : w·len · centroid
                            //   moment: -M  (CCW moment *reduces* the CW sum)

  for (const ld of norm) {
    if (ld.type === "point") {
      W += ld.P;
      sumMoment0 += ld.P * ld.x;
    } else if (ld.type === "udl") {
      const len = ld.xEnd - ld.xStart;
      if (len <= 0) {
        warnings.push(`UDL with zero or negative length skipped.`);
        continue;
      }
      const force = ld.w * len;
      W += force;
      sumMoment0 += force * (ld.xStart + ld.xEnd) / 2;
    } else {
      sumMoment0 -= ld.M;
    }
  }

  const reactions: BeamReactions = {};

  if (type === "simply-supported") {
    // Rb · L = sumMoment0   →   Rb = sumMoment0 / L
    // Ra = W - Rb
    const Rb = L > 0 ? sumMoment0 / L : 0;
    const Ra = W - Rb;
    reactions.Ra = Ra;
    reactions.Rb = Rb;
  } else {
    // Cantilever: fixed at x=0
    reactions.R = W;
    reactions.Mr = sumMoment0;
  }

  // ---- sample positions ----
  const numGrid = 250;
  const eps = Math.max(L * 1e-9, 1e-12);
  const positions: number[] = [];

  // regular grid
  for (let i = 0; i <= numGrid; i++) {
    positions.push((i / numGrid) * L);
  }

  // singularity positions (load application points + just-after)
  for (const ld of norm) {
    if (ld.type === "point" || ld.type === "moment") {
      const x = ld.x;
      if (x >= 0 && x <= L) {
        positions.push(x);
        if (x + eps <= L) positions.push(x + eps);
      }
    } else if (ld.type === "udl") {
      if (ld.xStart >= 0 && ld.xStart <= L) positions.push(ld.xStart);
      if (ld.xEnd >= 0 && ld.xEnd <= L)   positions.push(ld.xEnd);
    }
  }
  // just-after the left support
  if (eps <= L) positions.push(eps);

  // sort & deduplicate
  positions.sort((a, b) => a - b);
  const uniq: number[] = [];
  for (const p of positions) {
    const last = uniq[uniq.length - 1];
    if (uniq.length === 0 || p - last > eps / 2) {
      uniq.push(Math.max(0, Math.min(L, p)));
    }
  }

  // ---- V(x) and M(x) at each sample ----
  const samples: DiagramSample[] = [];

  for (const x of uniq) {
    let V = 0;
    let M = 0;

    // --- support reactions ---
    // A support reaction acts AT its own location, so it is included from that
    // position onward (x ≥ xSupport). This makes the shear diagram begin at the
    // reaction value (standard) rather than showing a spurious 0 at the support.
    if (type === "simply-supported") {
      // Ra at x = 0
      if (0 <= x && reactions.Ra !== undefined) {
        V += reactions.Ra;
        M += reactions.Ra * (x - 0);
      }
      // Rb at x = L  (only when L < x — never happens for x ≤ L)
      if (L < x && reactions.Rb !== undefined) {
        V += reactions.Rb;
        M += reactions.Rb * (x - L);
      }
    } else {
      // R at fixed end (x = 0)
      if (0 <= x && reactions.R !== undefined) {
        V += reactions.R;
        M += reactions.R * (x - 0);
      }
      // Reaction moment Mr at x=0 acts as an applied CCW moment → decreases M
      if (0 <= x && reactions.Mr !== undefined) {
        M -= reactions.Mr;
      }
    }

    // --- applied loads ---
    for (const ld of norm) {
      if (ld.type === "point") {
        if (ld.x < x) {
          V -= ld.P;
          M -= ld.P * (x - ld.x);
        }
      } else if (ld.type === "udl") {
        if (ld.xStart < x) {
          const partialEnd = Math.min(x, ld.xEnd);
          const partialLen = partialEnd - ld.xStart;
          if (partialLen > 0) {
            const partialForce = ld.w * partialLen;
            V -= partialForce;
            const centroid = ld.xStart + partialLen / 2;
            M -= partialForce * (x - centroid);
          }
        }
      } else {
        // applied moment — CCW decreases M
        if (ld.x < x) {
          M -= ld.M;
        }
      }
    }

    samples.push({ x, V, M });
  }

  // ---- extrema ----
  let Vmax = -Infinity, Vmin = Infinity;
  let Mmax = -Infinity, Mmin = Infinity;
  let VmaxLoc = 0, VminLoc = 0, MmaxLoc = 0, MminLoc = 0;

  for (const s of samples) {
    if (s.V > Vmax) { Vmax = s.V; VmaxLoc = s.x; }
    if (s.V < Vmin) { Vmin = s.V; VminLoc = s.x; }
    if (s.M > Mmax) { Mmax = s.M; MmaxLoc = s.x; }
    if (s.M < Mmin) { Mmin = s.M; MminLoc = s.x; }
  }

  if (!isFinite(Vmax)) { Vmax = 0; Vmin = 0; VmaxLoc = 0; VminLoc = 0; }
  if (!isFinite(Mmax)) { Mmax = 0; Mmin = 0; MmaxLoc = 0; MminLoc = 0; }

  return {
    reactions,
    samples,
    Vmax, Vmin, VmaxLoc, VminLoc,
    Mmax, Mmin, MmaxLoc, MminLoc,
    warnings,
  };
}
