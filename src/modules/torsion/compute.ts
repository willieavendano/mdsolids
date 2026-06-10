/**
 * Torsion of circular shafts — pure functions.
 * No DOM. Units are consistent; the caller decides what each unit means.
 *
 * A stepped shaft is N segments in series. Node 0 is fixed.
 * Segment i (1-indexed) runs from node i−1 to node i.
 * Torque T_i is applied at node i (right-hand positive).
 * Internal torque in segment i = sum of T_k for k ≥ i.
 */

export interface SegmentInput {
  /** Length of this segment */
  L: number;
  /** Shear modulus of this segment */
  G: number;
  /** Outer diameter */
  do: number;
  /** Inner diameter (0 for solid cross-section) */
  di: number;
  /** External torque applied at the right node of this segment */
  T: number;
}

export interface SegmentResult {
  /** Polar moment of inertia */
  J: number;
  /** Internal torque carried by this segment */
  Tinternal: number;
  /** Maximum shear stress */
  tauMax: number;
  /** Angle of twist of this segment (radians) */
  phi: number;
}

export interface TorsionResult {
  /** Per-segment computed results, in order from fixed end to free end */
  segments: SegmentResult[];
  /** Cumulative twist at each node: twists[0] = 0 at fixed end, twists[k] at node k */
  twists: number[];
  /** Total angle of twist at the free end (radians) */
  totalTwistRad: number;
  /** Total angle of twist at the free end (degrees) */
  totalTwistDeg: number;
}

/**
 * Analyze a stepped circular shaft under torsion.
 *
 * Guard rules:
 *  - L > 0, G > 0, do > 0
 *  - di ≥ 0 and di < do
 *  - Violations throw an Error with a human-readable message.
 */
export function torsionAnalysis(segments: SegmentInput[]): TorsionResult {
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const label = `Segment ${i + 1}`;
    if (s.L <= 0) throw new Error(`${label}: length must be positive`);
    if (s.G <= 0) throw new Error(`${label}: shear modulus must be positive`);
    if (s.do <= 0) throw new Error(`${label}: outer diameter must be positive`);
    if (s.di < 0) throw new Error(`${label}: inner diameter must be non-negative`);
    if (s.di >= s.do) throw new Error(`${label}: inner diameter (${s.di}) must be less than outer diameter (${s.do})`);
  }

  const N = segments.length;
  if (N === 0) {
    return { segments: [], twists: [0], totalTwistRad: 0, totalTwistDeg: 0 };
  }

  // Internal torques — accumulate from the free end toward the fixed end.
  const Tinternal: number[] = new Array(N);
  let sumT = 0;
  for (let i = N - 1; i >= 0; i--) {
    sumT += segments[i].T;
    Tinternal[i] = sumT;
  }

  const segResults: SegmentResult[] = [];
  const twists: number[] = [0];
  let cumulative = 0;

  for (let i = 0; i < N; i++) {
    const s = segments[i];

    // Polar moment of inertia: J = π·(do⁴ − di⁴) / 32
    const do4 = s.do ** 4;
    const di4 = s.di > 0 ? s.di ** 4 : 0;
    const J = (Math.PI / 32) * (do4 - di4);

    const T = Tinternal[i];
    const rOuter = s.do / 2;
    const tauMax = (T * rOuter) / J;
    const phi = (T * s.L) / (J * s.G);

    segResults.push({ J, Tinternal: T, tauMax, phi });

    cumulative += phi;
    twists.push(cumulative);
  }

  return {
    segments: segResults,
    twists,
    totalTwistRad: cumulative,
    totalTwistDeg: (cumulative * 180) / Math.PI,
  };
}
