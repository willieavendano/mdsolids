/**
 * Thin-walled pressure vessel analysis.
 * Pure functions — no DOM. Units are generic (force/len² for stress).
 */

export type VesselType = "cylinder" | "sphere";

export interface VesselInput {
  /** Internal gauge pressure */
  p: number;
  /** Inner radius */
  r: number;
  /** Wall thickness */
  t: number;
  /** Vessel geometry */
  type: VesselType;
}

export interface VesselResult {
  type: VesselType;
  /** Hoop (circumferential) stress */
  hoop: number;
  /** Longitudinal (axial) stress */
  longitudinal: number;
  /** Max in-plane shear = (σ_h − σ_l) / 2 */
  maxInPlaneShear: number;
  /** Absolute max shear (3-D, radial ≈ 0 at outer surface) */
  absMaxShear: number;
  /** Radius-to-thickness ratio */
  ratioRT: number;
  /** True when r/t ≥ 10 (thin-wall assumption holds) */
  thinWallValid: boolean;
}

/**
 * Compute stresses in a thin-walled pressure vessel.
 * Returns zero stresses and thinWallValid=false for invalid inputs (r ≤ 0 or t ≤ 0).
 */
export function vesselAnalysis(v: VesselInput): VesselResult {
  const { p, r, t, type } = v;

  // Guard invalid geometry
  if (r <= 0 || t <= 0) {
    return {
      type,
      hoop: 0,
      longitudinal: 0,
      maxInPlaneShear: 0,
      absMaxShear: 0,
      ratioRT: 0,
      thinWallValid: false,
    };
  }

  const ratioRT = r / t;
  const thinWallValid = ratioRT >= 10;

  if (type === "cylinder") {
    const hoop = (p * r) / t;
    const longitudinal = (p * r) / (2 * t);
    const maxInPlaneShear = (hoop - longitudinal) / 2;
    const absMaxShear = hoop / 2; // (σ_h − 0) / 2
    return {
      type,
      hoop,
      longitudinal,
      maxInPlaneShear,
      absMaxShear,
      ratioRT,
      thinWallValid,
    };
  }

  // sphere
  const sigma = (p * r) / (2 * t);
  return {
    type,
    hoop: sigma,
    longitudinal: sigma,
    maxInPlaneShear: 0, // equal biaxial → no in-plane shear
    absMaxShear: sigma / 2, // (σ − 0) / 2
    ratioRT,
    thinWallValid,
  };
}
