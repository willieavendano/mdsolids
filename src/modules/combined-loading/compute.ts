/**
 * Combined loading on a circular shaft — pure functions.
 * No DOM, no imports from other modules.
 *
 * A circular shaft (solid or hollow) carries an axial force P (tension
 * positive), a torque T, and a bending moment M simultaneously. We evaluate
 * the plane-stress state at the outer surface, at the extreme fiber that
 * GOVERNS — bending stress is ±|M|·c/I at the two extreme fibers, so the
 * governing fiber is the one where it stacks with (same sign as) the axial
 * stress, maximizing |σx|. With tension this is the bending-tension side;
 * with compression, the bending-compression side. M's sign therefore never
 * reduces the reported stresses.
 *
 *   A = π/4·(do² − di²)                    cross-sectional area
 *   I = π/64·(do⁴ − di⁴)                   second moment of area (bending)
 *   J = π/32·(do⁴ − di⁴) = 2·I              polar moment of area (torsion)
 *   c = do/2                                distance to outer fiber
 *
 *   σ_axial = P / A
 *   σ_bend  = M·c / I
 *   τ_tors  = T·c / J
 *
 * At the analysis point the plane-stress state is:
 *   σx = σ_axial + σ_bend   (axial and bending stack at the tension fiber)
 *   σy = 0                  (no stress on the free outer surface)
 *   τxy = τ_tors
 *
 * From there, standard Mohr's-circle relations give the principal stresses
 * and shear extremes (same convention as stress-transform/compute.ts,
 * duplicated here per the module contract — no cross-module imports):
 *
 *   center = (σx + σy)/2
 *   radius = √(((σx − σy)/2)² + τxy²)
 *   σ1 = center + radius,  σ2 = center − radius
 *   τ_max,in-plane = radius
 *   θp = ½·atan2(2·τxy, σx − σy)   [rad → deg]
 *
 * The ABSOLUTE maximum shear stress additionally accounts for the
 * out-of-plane principal stress (σ3 = 0 at a free surface):
 *   τ_max,abs = max(|σ1 − σ2|, |σ1 − 0|, |σ2 − 0|) / 2
 */

export type ShaftShape = "solid" | "hollow";

export interface CombinedLoadingInput {
  /** Solid or hollow circular cross-section. */
  shape: ShaftShape;
  /** Outer diameter. */
  do: number;
  /** Inner diameter (ignored — treated as 0 — when shape is "solid"). */
  di: number;
  /** Axial force, tension positive. */
  P: number;
  /** Torque. */
  T: number;
  /** Bending moment. */
  M: number;
}

export interface CombinedLoadingResult {
  /** Cross-sectional area. */
  A: number;
  /** Second moment of area (bending). */
  I: number;
  /** Polar moment of area (torsion). */
  J: number;
  /** Distance from centroid to outer fiber (do/2). */
  c: number;
  /** Normal stress from axial force alone. */
  sigmaAxial: number;
  /** Normal stress from bending alone at the governing fiber (signed to
   *  stack with the axial stress; magnitude |M|·c/I). */
  sigmaBend: number;
  /** Shear stress from torsion alone, at the outer surface. */
  tauTorsion: number;
  /** Combined normal stress on the x-face (σ_axial + σ_bend). */
  sx: number;
  /** Normal stress on the y-face (0 at a free surface). */
  sy: number;
  /** Shear stress on the xy-face (= tauTorsion). */
  txy: number;
  /** Larger in-plane principal stress. */
  sigma1: number;
  /** Smaller in-plane principal stress. */
  sigma2: number;
  /** Maximum in-plane shear stress (Mohr's-circle radius). */
  tauMaxInPlane: number;
  /** Absolute maximum shear stress, accounting for the free-surface σ3 = 0. */
  tauMaxAbsolute: number;
  /** Principal-plane angle, degrees. */
  thetaPdeg: number;
}

/**
 * Analyze a circular shaft under combined axial + torsion + bending loads.
 *
 * Guard rules:
 *  - do > 0
 *  - for hollow shapes: di ≥ 0 and di < do
 *  - the resulting cross-section must have positive area
 * Violations throw an Error with a human-readable message.
 */
export function combinedLoadingAnalysis(
  input: CombinedLoadingInput,
): CombinedLoadingResult {
  const doOuter = input.do;
  if (!(doOuter > 0)) throw new Error("Outer diameter must be positive");

  // A "solid" shaft ignores whatever di was passed — always treated as 0.
  const di = input.shape === "hollow" ? input.di : 0;
  if (input.shape === "hollow") {
    if (di < 0) throw new Error("Inner diameter must be non-negative");
    if (di >= doOuter)
      throw new Error(
        `Inner diameter (${di}) must be less than outer diameter (${doOuter})`,
      );
  }

  const A = (Math.PI / 4) * (doOuter ** 2 - di ** 2);
  if (!(A > 0)) throw new Error("Cross-section has zero or negative area");

  const I = (Math.PI / 64) * (doOuter ** 4 - di ** 4);
  const J = 2 * I; // = π/32·(do⁴ − di⁴)
  const c = doOuter / 2;

  const sigmaAxial = input.P / A;
  // Bending is fiber-symmetric (±|M|c/I); analyze the governing fiber, where
  // it carries the same sign as the axial stress so |σx| is maximized.
  const sigmaBend = (Math.abs(input.M) * c) / I * (sigmaAxial < 0 ? -1 : 1);
  const tauTorsion = (input.T * c) / J;

  const sx = sigmaAxial + sigmaBend;
  const sy = 0;
  const txy = tauTorsion;

  const center = (sx + sy) / 2;
  const diff = (sx - sy) / 2;
  const radius = Math.sqrt(diff * diff + txy * txy);

  const sigma1 = center + radius;
  const sigma2 = center - radius;
  const tauMaxInPlane = radius;
  const tauMaxAbsolute =
    Math.max(Math.abs(sigma1 - sigma2), Math.abs(sigma1), Math.abs(sigma2)) / 2;

  let thetaPdeg = 0;
  // atan2(0,0) is implementation-defined; treat the degenerate (no-load) case explicitly.
  if (Math.abs(diff) > 1e-12 || Math.abs(txy) > 1e-12) {
    thetaPdeg = 0.5 * Math.atan2(2 * txy, sx - sy) * (180 / Math.PI);
  }

  return {
    A,
    I,
    J,
    c,
    sigmaAxial,
    sigmaBend,
    tauTorsion,
    sx,
    sy,
    txy,
    sigma1,
    sigma2,
    tauMaxInPlane,
    tauMaxAbsolute,
    thetaPdeg,
  };
}
