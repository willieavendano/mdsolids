import { describe, it, expect } from "vitest";
import { axialAnalysis, type SegmentInput } from "./compute";

describe("axialAnalysis", () => {
  it("single segment under tension", () => {
    // L=2, A=0.5, E=100, P=10 →
    // N=10, σ=20, δ=10·2/(0.5·100)=0.4, u₁=0.4
    const segs: SegmentInput[] = [{ L: 2, A: 0.5, E: 100, P: 10 }];
    const result = axialAnalysis(segs);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].N).toBeCloseTo(10);
    expect(result.segments[0].sigma).toBeCloseTo(20);
    expect(result.segments[0].delta).toBeCloseTo(0.4);

    expect(result.displacements).toEqual([0, 0.4]);
    expect(result.totalElongation).toBeCloseTo(0.4);
  });

  it("single segment under compression", () => {
    // L=1, A=1, E=100, P=-5 →
    // N=-5, σ=-5, δ=-5·1/(1·100)=-0.05
    const segs: SegmentInput[] = [{ L: 1, A: 1, E: 100, P: -5 }];
    const result = axialAnalysis(segs);

    expect(result.segments[0].N).toBeCloseTo(-5);
    expect(result.segments[0].sigma).toBeCloseTo(-5);
    expect(result.segments[0].delta).toBeCloseTo(-0.05);

    expect(result.displacements).toEqual([0, -0.05]);
    expect(result.totalElongation).toBeCloseTo(-0.05);
  });

  it("two segments with load only at free end", () => {
    // Seg 1: L=3, A=1, E=200, P₁=0  (between nodes 0–1)
    // Seg 2: L=2, A=0.5, E=100, P₂=10 (between nodes 1–2, free end)
    //
    // N₁ = P₁+P₂ = 10   → σ₁=10/1=10, δ₁=10·3/(1·200)=0.15
    // N₂ = P₂ = 10      → σ₂=10/0.5=20, δ₂=10·2/(0.5·100)=0.4
    // u₀=0, u₁=0.15, u₂=0.55
    const segs: SegmentInput[] = [
      { L: 3, A: 1, E: 200, P: 0 },
      { L: 2, A: 0.5, E: 100, P: 10 },
    ];
    const result = axialAnalysis(segs);

    expect(result.segments).toHaveLength(2);

    expect(result.segments[0].N).toBeCloseTo(10);
    expect(result.segments[0].sigma).toBeCloseTo(10);
    expect(result.segments[0].delta).toBeCloseTo(0.15);

    expect(result.segments[1].N).toBeCloseTo(10);
    expect(result.segments[1].sigma).toBeCloseTo(20);
    expect(result.segments[1].delta).toBeCloseTo(0.4);

    expect(result.displacements[0]).toBeCloseTo(0);
    expect(result.displacements[1]).toBeCloseTo(0.15);
    expect(result.displacements[2]).toBeCloseTo(0.55);
    expect(result.totalElongation).toBeCloseTo(0.55);
  });

  it("three segments with mixed tension and compression", () => {
    // Seg 1: L=1, A=1, E=100, P₁=5   (node 1)
    // Seg 2: L=1, A=1, E=100, P₂=-3  (node 2)
    // Seg 3: L=1, A=1, E=100, P₃=2   (node 3, free end)
    //
    // N₃ = P₃ = 2                → σ₃=2, δ₃=0.02
    // N₂ = P₂+P₃ = -3+2 = -1    → σ₂=-1, δ₂=-0.01
    // N₁ = P₁+P₂+P₃ = 5-3+2 = 4 → σ₁=4, δ₁=0.04
    // u₀=0, u₁=0.04, u₂=0.03, u₃=0.05
    const segs: SegmentInput[] = [
      { L: 1, A: 1, E: 100, P: 5 },
      { L: 1, A: 1, E: 100, P: -3 },
      { L: 1, A: 1, E: 100, P: 2 },
    ];
    const result = axialAnalysis(segs);

    expect(result.segments).toHaveLength(3);

    expect(result.segments[0].N).toBeCloseTo(4);
    expect(result.segments[0].sigma).toBeCloseTo(4);
    expect(result.segments[0].delta).toBeCloseTo(0.04);

    expect(result.segments[1].N).toBeCloseTo(-1);
    expect(result.segments[1].sigma).toBeCloseTo(-1);
    expect(result.segments[1].delta).toBeCloseTo(-0.01);

    expect(result.segments[2].N).toBeCloseTo(2);
    expect(result.segments[2].sigma).toBeCloseTo(2);
    expect(result.segments[2].delta).toBeCloseTo(0.02);

    expect(result.displacements).toHaveLength(4);
    expect(result.displacements[0]).toBeCloseTo(0);
    expect(result.displacements[1]).toBeCloseTo(0.04);
    expect(result.displacements[2]).toBeCloseTo(0.03);
    expect(result.displacements[3]).toBeCloseTo(0.05);
    expect(result.totalElongation).toBeCloseTo(0.05);
  });

  it("empty segments returns safe defaults", () => {
    const result = axialAnalysis([]);
    expect(result.segments).toEqual([]);
    expect(result.displacements).toEqual([0]);
    expect(result.totalElongation).toBe(0);
  });
});
