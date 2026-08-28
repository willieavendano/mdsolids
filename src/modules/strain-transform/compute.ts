/**
 * Plane-strain transformation, principal strains, and strain-rosette
 * reduction — pure functions. No DOM, no imports from other modules.
 *
 * Strain values are dimensionless (typically entered in microstrain, με,
 * by the caller); angles are in degrees unless noted. The engineering
 * shear strain γxy (not the tensor shear εxy = γxy/2) is used throughout,
 * matching standard mechanics-of-materials convention.
 *
 * Convention: normal strain positive in extension; γxy positive when the
 * angle between the +x and +y edges decreases (same sign convention as
 * τ_xy in the analogous plane-stress transformation).
 */

export interface PlaneStrainState {
  ex: number;
  ey: number;
  gxy: number;
}

export interface TransformedStrain {
  ex1: number;
  ey1: number;
  gx1y1: number;
}

export interface PrincipalStrainResult {
  e1: number;
  e2: number;
  thetaP: number; // degrees
  gammaMax: number; // max in-plane engineering shear strain
  eAvg: number;
  center: number; // Mohr's-circle center (== eAvg)
  radius: number; // Mohr's-circle radius
}

/** Throws if any argument is not a finite number. */
function assertFinite(vals: number[], label = "input"): void {
  for (const v of vals) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`Strain transformation: ${label} must be finite numbers.`);
    }
  }
}

/**
 * Transform plane strains to axes rotated by `thetaDeg` (counter-clockwise)
 * from the original x-y axes.
 *
 *  εx' = (εx+εy)/2 + (εx−εy)/2·cos(2θ) + (γxy/2)·sin(2θ)
 *  εy' = (εx+εy)/2 − (εx−εy)/2·cos(2θ) − (γxy/2)·sin(2θ)
 *  γx'y'/2 = −(εx−εy)/2·sin(2θ) + (γxy/2)·cos(2θ)
 */
export function transformStrain(
  ex: number,
  ey: number,
  gxy: number,
  thetaDeg: number,
): TransformedStrain {
  assertFinite([ex, ey, gxy, thetaDeg], "transformStrain arguments");

  const th = (thetaDeg * Math.PI) / 180;
  const cos2t = Math.cos(2 * th);
  const sin2t = Math.sin(2 * th);
  const avg = (ex + ey) / 2;
  const diff = (ex - ey) / 2;
  const halfG = gxy / 2;

  const ex1 = avg + diff * cos2t + halfG * sin2t;
  const ey1 = avg - diff * cos2t - halfG * sin2t;
  const halfG1 = -diff * sin2t + halfG * cos2t;

  return { ex1, ey1, gx1y1: 2 * halfG1 };
}

/**
 * Principal strains, max in-plane shear strain, and Mohr's-circle
 * parameters for a plane-strain state.
 *
 *  Center  C = (εx + εy)/2
 *  Radius  R = √(((εx−εy)/2)² + (γxy/2)²)
 *  ε₁ = C + R,   ε₂ = C − R
 *  θₚ = ½·atan2(γxy, εx−εy)   [rad → deg]
 *  γ_max (in-plane) = 2R
 *
 * When εx = εy and γxy = 0 the circle degenerates to a point (R = 0) and
 * θₚ is returned as 0°.
 */
export function principalStrains(ex: number, ey: number, gxy: number): PrincipalStrainResult {
  assertFinite([ex, ey, gxy], "principalStrains arguments");

  const center = (ex + ey) / 2;
  const diff = (ex - ey) / 2;
  const halfG = gxy / 2;
  const radius = Math.sqrt(diff * diff + halfG * halfG);

  let thetaP = 0;
  // atan2(0,0) is implementation-defined; treat the degenerate case explicitly.
  if (Math.abs(diff) > 1e-12 || Math.abs(gxy) > 1e-12) {
    thetaP = 0.5 * Math.atan2(gxy, ex - ey) * (180 / Math.PI);
  }

  return {
    e1: center + radius,
    e2: center - radius,
    thetaP,
    gammaMax: 2 * radius,
    eAvg: center,
    center,
    radius,
  };
}

/**
 * Rectangular (45°) strain rosette — gauges at 0°, 45°, 90°.
 *
 *  εx = εa
 *  εy = εc
 *  γxy = 2εb − εa − εc
 */
export function rosette45(ea: number, eb: number, ec: number): PlaneStrainState {
  assertFinite([ea, eb, ec], "rosette45 arguments");
  return {
    ex: ea,
    ey: ec,
    gxy: 2 * eb - ea - ec,
  };
}

/**
 * Delta (60°) strain rosette — gauges at 0°, 60°, 120°.
 *
 *  εx = εa
 *  εy = (2εb + 2εc − εa)/3
 *  γxy = 2(εb − εc)/√3
 */
export function rosette60(ea: number, eb: number, ec: number): PlaneStrainState {
  assertFinite([ea, eb, ec], "rosette60 arguments");
  return {
    ex: ea,
    ey: (2 * eb + 2 * ec - ea) / 3,
    gxy: (2 * (eb - ec)) / Math.sqrt(3),
  };
}
