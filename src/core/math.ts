/**
 * Shared numerical helpers. Pure, dependency-free, unit-tested.
 * Used by modules that need linear algebra (e.g. the truss solver).
 */

/**
 * Solve the dense linear system A x = b by Gaussian elimination with partial
 * pivoting. `A` is n×n (row-major), `b` is length n. Returns x, or null if the
 * system is singular / ill-conditioned (e.g. an unstable truss mechanism).
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Work on copies so callers keep their inputs.
  const M = A.map((row) => row.slice());
  const x = b.slice();

  for (let col = 0; col < n; col++) {
    // Partial pivot: find the largest magnitude entry in this column.
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null; // singular

    if (pivot !== col) {
      [M[col], M[pivot]] = [M[pivot], M[col]];
      [x[col], x[pivot]] = [x[pivot], x[col]];
    }

    // Eliminate below.
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / M[col][col];
      if (factor === 0) continue;
      for (let c = col; c < n; c++) M[r][c] -= factor * M[col][c];
      x[r] -= factor * x[col];
    }
  }

  // Back-substitution.
  for (let row = n - 1; row >= 0; row--) {
    let sum = x[row];
    for (let c = row + 1; c < n; c++) sum -= M[row][c] * x[c];
    x[row] = sum / M[row][row];
  }
  return x;
}

/** Clamp a number to [lo, hi]. */
export const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Degrees → radians. */
export const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Radians → degrees. */
export const deg = (r: number): number => (r * 180) / Math.PI;
