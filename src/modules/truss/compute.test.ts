import { describe, it, expect } from "vitest";
import { analyzeTruss, type Node, type Member } from "./compute";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a node with zero load. */
function n(
  id: string,
  x: number,
  y: number,
  support: Node["support"] = "free",
  fx = 0,
  fy = 0,
): Node {
  return { id, x, y, support, load: { fx, fy } };
}

/** Shortcut for a member between two node ids. */
function m(a: string, b: string): Member {
  return { a, b };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeTruss", () => {
  it("3-bar triangle: checks equilibrium and reaction balance", () => {
    // Classic triangle truss with a downward load at the apex C.
    // A(0,0) pin, B(4,0) roller-x, C(2,3) with downward load 10.
    // Hand-checked: F_AC = F_BC ≈ −6.01 (compression), F_AB ≈ +3.33 (tension),
    // A reactions: Rx≈0, Ry≈+5;  B reaction: Ry≈+5.
    const nodes: Node[] = [
      n("A", 0, 0, "pin"),
      n("B", 4, 0, "roller-x"),
      n("C", 2, 3, "free", 0, -10),
    ];
    const members: Member[] = [m("A", "C"), m("B", "C"), m("A", "B")];

    const r = analyzeTruss(nodes, members);

    expect(r.stable).toBe(true);
    expect(r.determinate).toBe(true);

    // Member forces
    const ac = r.memberForces.find((f) => f.a === "A" && f.b === "C")!;
    const bc = r.memberForces.find((f) => f.a === "B" && f.b === "C")!;
    const ab = r.memberForces.find((f) => f.a === "A" && f.b === "B")!;

    expect(ac.kind).toBe("compression");
    expect(bc.kind).toBe("compression");
    expect(ab.kind).toBe("tension");

    // Numeric values (loose tolerance: 1e-6 relative, but here ~0.01 absolute)
    expect(ac.force).toBeCloseTo(-6.009, 1); // −6.01
    expect(bc.force).toBeCloseTo(-6.009, 1);
    expect(ab.force).toBeCloseTo(3.333, 1); // +3.33

    // Reactions — vertical must sum to 10 (balance the load)
    const vertReaction = r.reactions.reduce(
      (sum, rxn) => sum + (rxn.ry ?? 0),
      0,
    );
    expect(vertReaction).toBeCloseTo(10, 5);

    // Horizontal reaction at A should be ~0
    const rx = r.reactions.find((rxn) => rxn.node === "A")!.rx;
    expect(rx).toBeCloseTo(0, 5);
  });

  it("single horizontal member carries the applied axial load", () => {
    // A pin ——— B roller-x   with a horizontal pull of 5 at B.
    // The member must carry exactly 5 in tension.
    const nodes: Node[] = [
      n("A", 0, 0, "pin"),
      n("B", 4, 0, "roller-x", 5, 0),
    ];
    const members: Member[] = [m("A", "B")];

    const r = analyzeTruss(nodes, members);

    expect(r.stable).toBe(true);
    expect(r.determinate).toBe(true);

    expect(r.memberForces).toHaveLength(1);
    expect(r.memberForces[0].force).toBeCloseTo(5, 5);
    expect(r.memberForces[0].kind).toBe("tension");

    // Reaction at A must balance the 5 (Rx = −5, Ry = 0)
    const ra = r.reactions.find((rxn) => rxn.node === "A")!;
    expect(ra.rx).toBeCloseTo(-5, 5);
    expect(ra.ry).toBeCloseTo(0, 5);

    // Reaction at B (roller-x) — no horizontal, vertical = 0
    const rb = r.reactions.find((rxn) => rxn.node === "B")!;
    expect(rb.rx).toBeUndefined();
    expect(rb.ry).toBeCloseTo(0, 5);
  });

  it("zero-force members: two non-collinear bars at an unloaded joint", () => {
    // A(0,0) pin, B(4,0) pin, C(2,2) free, no load anywhere.
    // AC and BC meet at C; they are non-collinear and C has no load.
    // Classical statics: both must be zero-force.
    const nodes: Node[] = [
      n("A", 0, 0, "pin"),
      n("B", 4, 0, "pin"),
      n("C", 2, 2, "free"),
    ];
    const members: Member[] = [m("A", "C"), m("B", "C")];

    const r = analyzeTruss(nodes, members);

    expect(r.stable).toBe(true);
    expect(r.determinate).toBe(true);

    expect(r.memberForces).toHaveLength(2);
    for (const mf of r.memberForces) {
      expect(mf.kind).toBe("zero");
      expect(mf.force).toBeCloseTo(0, 8);
    }

    // All reactions must also be zero (no load)
    for (const rxn of r.reactions) {
      if (rxn.rx !== undefined) expect(rxn.rx).toBeCloseTo(0, 8);
      if (rxn.ry !== undefined) expect(rxn.ry).toBeCloseTo(0, 8);
    }
  });

  it("flags an unstable truss (mechanism)", () => {
    // Four nodes forming a quadrilateral with one diagonal missing —
    // a classic unstable linkage.  Only 4 members, pins at A & B.
    // 4 nodes × 2 = 8 eqns;  4 members + 4 reactions = 8 unknowns → square,
    // but the stiffness matrix is singular because of the mechanism.
    const nodes: Node[] = [
      n("A", 0, 0, "pin"),
      n("B", 4, 0, "pin"),
      n("C", 4, 3, "free"),
      n("D", 0, 3, "free"),
    ];
    const members: Member[] = [
      m("A", "B"),
      m("B", "C"),
      m("C", "D"),
      m("D", "A"),
    ];

    const r = analyzeTruss(nodes, members);
    expect(r.stable).toBe(false);
    // All forces should be reported as zero
    for (const mf of r.memberForces) {
      expect(mf.kind).toBe("zero");
    }
  });

  it("warns when statically indeterminate", () => {
    // Fully triangulated truss with extra redundant member →
    // more unknowns than equations.
    // 4 nodes, 6 members, 2 pin supports (4 reactions) = 10 unknowns, 8 eqns.
    const nodes: Node[] = [
      n("A", 0, 0, "pin"),
      n("B", 4, 0, "pin"),
      n("C", 4, 3, "free", 0, -5),
      n("D", 0, 3, "free"),
    ];
    const members: Member[] = [
      m("A", "B"),
      m("B", "C"),
      m("C", "D"),
      m("D", "A"),
      m("A", "C"), // extra diagonal
      m("B", "D"), // extra diagonal
    ];

    const r = analyzeTruss(nodes, members);
    // System may or may not be stable, but it's definitely indeterminate
    expect(r.determinate).toBe(false);
    // Even though indeterminate, the solver may still produce a valid
    // least-squares / pseudo-inverse solution — valid forces should be finite.
    if (r.stable) {
      for (const mf of r.memberForces) {
        expect(Number.isFinite(mf.force)).toBe(true);
      }
    }
  });
});
