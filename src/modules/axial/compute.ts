/**
 * Axial Deformation — pure functions for normal stress and elongation
 * of axially loaded bars and segmented assemblies.
 *
 * Model: N segments in series along the x-axis. Node 0 (left) is FIXED.
 * Segment i spans node i-1 → i. External axial point load P_i (positive
 * in +x, i.e. tension pulling away from the wall) is applied at node i.
 *
 * Units are generic — the caller decides what "len", "force", and
 * "stress = force/len²" mean. Keep inputs in a consistent unit system.
 */

export interface SegmentInput {
  /** Segment length (>0). */
  L: number;
  /** Cross-sectional area (>0). */
  A: number;
  /** Elastic (Young's) modulus (>0). */
  E: number;
  /** External axial point load applied at this segment's RIGHT node.
   *  Positive = tension (+x, pulling away from the fixed end). */
  P: number;
}

export interface SegmentResult {
  /** Internal axial force in the segment. */
  N: number;
  /** Normal stress σ = N / A. */
  sigma: number;
  /** Elongation δ = N·L / (A·E). */
  delta: number;
}

export interface AxialResult {
  /** Per-segment results, in order from fixed end (index 0) to free end. */
  segments: SegmentResult[];
  /** Node displacements u₀…u_N (u₀ = 0, u_k = Σᵢ₌₁ᵏ δ_i). */
  displacements: number[];
  /** Total elongation = u_N. */
  totalElongation: number;
}

/**
 * Compute internal forces, stresses, elongations, and displacements
 * for an axially loaded segmented bar.
 *
 * The fixed end is at node 0, to the left of the first segment.
 * Each segment's `P` is applied at its right node.
 *
 * Guards: A ≤ 0, E ≤ 0, or L ≤ 0 will naturally produce non-finite
 * results (Infinity / NaN). The caller should validate inputs and
 * warn the user before displaying.
 */
export function axialAnalysis(segments: SegmentInput[]): AxialResult {
  const N = segments.length;
  if (N === 0) {
    return { segments: [], displacements: [0], totalElongation: 0 };
  }

  // Internal forces: N_i = sum of P_k for k >= i
  // (equilibrium of the free body to the right of a cut in segment i)
  const forces: number[] = new Array(N);
  let runningSum = 0;
  for (let i = N - 1; i >= 0; i--) {
    runningSum += segments[i].P;
    forces[i] = runningSum;
  }

  const segResults: SegmentResult[] = [];
  const displacements: number[] = [0]; // u₀ = 0
  let cumDisp = 0;

  for (let i = 0; i < N; i++) {
    const seg = segments[i];
    const N_i = forces[i];
    const sigma = N_i / seg.A;
    const delta = (N_i * seg.L) / (seg.A * seg.E);
    segResults.push({ N: N_i, sigma, delta });
    cumDisp += delta;
    displacements.push(cumDisp);
  }

  return {
    segments: segResults,
    displacements,
    totalElongation: cumDisp,
  };
}
