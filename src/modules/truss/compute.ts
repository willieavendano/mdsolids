/**
 * Truss Analysis — method of joints for 2D pin-jointed trusses.
 * Pure functions — no DOM. Generic units; the caller decides what
 * force and length units mean.
 *
 * Uses solveLinearSystem from ../../core/math for the equilibrium matrix.
 */

import { solveLinearSystem } from "../../core/math";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupportKind = "free" | "pin" | "roller-x" | "roller-y";

export interface Node {
  /** Display label / unique id. */
  id: string;
  x: number;
  y: number;
  support: SupportKind;
  /** Applied external load at the joint. */
  load: { fx: number; fy: number };
}

export interface Member {
  /** Node id of first joint (a → b defines the member's local +x direction). */
  a: string;
  /** Node id of second joint. */
  b: string;
}

export interface MemberForce {
  a: string;
  b: string;
  /** Positive = tension (member pulls joints toward itself). */
  force: number;
  kind: "tension" | "compression" | "zero";
}

export interface Reaction {
  node: string;
  rx?: number;
  ry?: number;
}

export interface TrussResult {
  memberForces: MemberForce[];
  reactions: Reaction[];
  /** True when unknowns == equations (M member forces + R reaction components == 2 × N nodes). */
  determinate: boolean;
  /** False when the equilibrium matrix is singular (mechanism / unstable). */
  stable: boolean;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

const TOL = 1e-9;

/**
 * Analyse a pin-jointed 2D truss by the direct stiffness / method-of-joints
 * equilibrium matrix.  Returns member forces (tension positive), support
 * reactions, and determinacy/stability flags.
 *
 * When the matrix is singular the truss is flagged as unstable and all
 * member forces are reported as zero.
 */
export function analyzeTruss(
  nodes: Node[],
  members: Member[],
): TrussResult {
  const N = nodes.length;
  const M = members.length;

  // ---- node id → index --------------------------------------------------
  const idToIdx = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    idToIdx.set(nodes[i].id, i);
  }

  // ---- count reaction unknowns & assign column indices ------------------
  const rxCol = new Array<number>(N).fill(-1);
  const ryCol = new Array<number>(N).fill(-1);
  let reactionCol = M; // reactions start after member-force columns

  for (let i = 0; i < N; i++) {
    const s = nodes[i].support;
    if (s === "pin") {
      rxCol[i] = reactionCol++;
      ryCol[i] = reactionCol++;
    } else if (s === "roller-x") {
      ryCol[i] = reactionCol++;
    } else if (s === "roller-y") {
      rxCol[i] = reactionCol++;
    }
    // free → neither
  }

  const Rcount = reactionCol - M;
  const totalCols = M + Rcount;
  const rows = 2 * N;

  // ---- build matrix A and RHS vector b -------------------------------
  const A: number[][] = Array.from(
    { length: rows },
    () => new Array<number>(totalCols).fill(0),
  );
  const b: number[] = new Array<number>(rows).fill(0);

  // Member contributions
  for (let j = 0; j < M; j++) {
    const m = members[j];
    const ai = idToIdx.get(m.a);
    const bi = idToIdx.get(m.b);
    if (ai === undefined || bi === undefined) continue;

    const na = nodes[ai];
    const nb = nodes[bi];
    const dx = nb.x - na.x;
    const dy = nb.y - na.y;
    const L = Math.sqrt(dx * dx + dy * dy);
    if (L < TOL) continue; // degenerate member — skip

    const cx = dx / L;
    const cy = dy / L;

    // At joint a, tension F contributes +F·(cx, cy)  (pulls a toward b)
    A[2 * ai][j] = cx;
    A[2 * ai + 1][j] = cy;
    // At joint b, tension F contributes −F·(cx, cy)  (equal & opposite)
    A[2 * bi][j] = -cx;
    A[2 * bi + 1][j] = -cy;
  }

  // Reaction contributions  (+1 coefficient for each unknown component)
  for (let i = 0; i < N; i++) {
    if (rxCol[i] >= 0) A[2 * i][rxCol[i]] = 1;
    if (ryCol[i] >= 0) A[2 * i + 1][ryCol[i]] = 1;
  }

  // RHS = −applied load  so that  (member terms) + (reaction terms) = −(load)
  for (let i = 0; i < N; i++) {
    const node = nodes[i];
    b[2 * i] = -(node.load?.fx ?? 0);
    b[2 * i + 1] = -(node.load?.fy ?? 0);
  }

  // ---- solve -----------------------------------------------------------
  const x = solveLinearSystem(A, b);

  if (x === null) {
    // Singular → unstable (mechanism)
    return {
      memberForces: members.map((m) => ({
        a: m.a,
        b: m.b,
        force: 0,
        kind: "zero" as const,
      })),
      reactions: [],
      determinate: M + Rcount === rows,
      stable: false,
    };
  }

  // ---- extract member forces -------------------------------------------
  const memberForces: MemberForce[] = [];
  for (let j = 0; j < M; j++) {
    const force = x[j];
    const absF = Math.abs(force);
    let kind: "tension" | "compression" | "zero";
    if (absF < TOL) {
      kind = "zero";
    } else if (force > 0) {
      kind = "tension";
    } else {
      kind = "compression";
    }
    memberForces.push({
      a: members[j].a,
      b: members[j].b,
      force,
      kind,
    });
  }

  // ---- extract reactions -----------------------------------------------
  const reactions: Reaction[] = [];
  for (let i = 0; i < N; i++) {
    const node = nodes[i];
    if (node.support === "free") continue;
    const r: Reaction = { node: node.id };
    if (rxCol[i] >= 0) r.rx = x[rxCol[i]];
    if (ryCol[i] >= 0) r.ry = x[ryCol[i]];
    reactions.push(r);
  }

  return {
    memberForces,
    reactions,
    determinate: M + Rcount === rows,
    stable: true,
  };
}
