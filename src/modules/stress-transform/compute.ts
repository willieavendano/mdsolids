/**
 * Plane-stress transformation and Mohr's circle — pure functions.
 * No DOM, no imports from other modules. Units are generic "stress";
 * the caller decides what the units mean.
 *
 * Convention: normal stress positive in tension, shear stress positive
 * per standard mechanics-of-materials sign convention (τ_xy positive
 * on the +x face pointing in the +y direction).
 */

export interface StressState {
  sx: number;
  sy: number;
  txy: number;
}

export interface TransformedStress {
  sxp: number;
  syp: number;
  txyp: number;
}

export interface PrincipalResult {
  sigma1: number;
  sigma2: number;
  thetaPdeg: number;
  tauMax: number;
  avg: number;
  center: number;
  radius: number;
}

/**
 * Transform plane stresses to a coordinate system rotated by `thetaDeg`
 * (counter-clockwise) from the original axes.
 *
 *  σ_x' = (sx+sy)/2 + (sx-sy)/2·cos(2θ) + τ_xy·sin(2θ)
 *  σ_y' = (sx+sy)/2 − (sx-sy)/2·cos(2θ) − τ_xy·sin(2θ)
 *  τ_x'y' = −(sx-sy)/2·sin(2θ) + τ_xy·cos(2θ)
 */
export function transform(s: StressState, thetaDeg: number): TransformedStress {
  const th = (thetaDeg * Math.PI) / 180;
  const cos2t = Math.cos(2 * th);
  const sin2t = Math.sin(2 * th);
  const avg = (s.sx + s.sy) / 2;
  const diff = (s.sx - s.sy) / 2;

  return {
    sxp: avg + diff * cos2t + s.txy * sin2t,
    syp: avg - diff * cos2t - s.txy * sin2t,
    txyp: -diff * sin2t + s.txy * cos2t,
  };
}

/**
 * Principal stresses, max in-plane shear, and Mohr's circle parameters.
 *
 *  Center  C = (sx + sy)/2
 *  Radius  R = √(((sx−sy)/2)² + τ_xy²)
 *  σ₁ = C + R,   σ₂ = C − R
 *  θₚ = ½·atan2(2·τ_xy, sx−sy)   [rad → deg]
 *  τ_max = R
 *
 * When sx = sy and τ_xy = 0 the Mohr's circle degenerates to a point
 * (R = 0) and θₚ is returned as 0°.
 */
export function principal(s: StressState): PrincipalResult {
  const center = (s.sx + s.sy) / 2;
  const diff = (s.sx - s.sy) / 2;
  const radius = Math.sqrt(diff * diff + s.txy * s.txy);

  let thetaPdeg = 0;
  // atan2(0,0) is implementation-defined; treat the degenerate case explicitly
  if (Math.abs(diff) > 1e-12 || Math.abs(s.txy) > 1e-12) {
    thetaPdeg = 0.5 * Math.atan2(2 * s.txy, s.sx - s.sy) * (180 / Math.PI);
  }

  return {
    sigma1: center + radius,
    sigma2: center - radius,
    thetaPdeg,
    tauMax: radius,
    avg: center,
    center,
    radius,
  };
}
