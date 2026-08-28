import { describe, it, expect } from "vitest";
import {
  buildHash,
  decodeState,
  encodeState,
  makeSaveFile,
  parseHash,
  parseSaveFile,
} from "./state";

describe("state encoding", () => {
  it("round-trips arbitrary JSON state", () => {
    const state = {
      segments: [{ L: 12, G: 1, do: 4, di: 0, T: 100 }],
      note: "ünïcode ✓ △",
    };
    const encoded = encodeState(state);
    expect(encoded).toBeTruthy();
    expect(decodeState(encoded!)).toEqual(state);
  });

  it("produces URL-safe output (no + / = characters)", () => {
    const encoded = encodeState({ a: [255, 254, 253], s: "??>>~~" });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns undefined for corrupt payloads", () => {
    expect(decodeState("not-base64!!")).toBeUndefined();
    expect(decodeState(encodeState("x")!.slice(0, 3) + "@@")).toBeUndefined();
  });

  it("returns null when state cannot be serialized", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(encodeState(cyclic)).toBeNull();
  });
});

describe("hash routing", () => {
  it("parses a bare module route", () => {
    expect(parseHash("#/torsion")).toEqual({ id: "torsion" });
    expect(parseHash("#torsion").id).toBe("torsion");
    expect(parseHash("").id).toBe("");
  });

  it("round-trips module id + state through the hash", () => {
    const state = { P: 10, L: 2.5 };
    const hash = buildHash("axial", state);
    expect(hash.startsWith("#/axial?s=")).toBe(true);
    expect(parseHash(hash)).toEqual({ id: "axial", state });
  });

  it("ignores corrupt state in the hash but keeps the route", () => {
    const parsed = parseHash("#/axial?s=%%%garbage");
    expect(parsed.id).toBe("axial");
    expect(parsed.state).toBeUndefined();
  });
});

describe("save files", () => {
  it("round-trips through the file envelope", () => {
    const file = makeSaveFile("beam", { loads: [1, 2, 3] });
    const parsed = parseSaveFile(JSON.stringify(file));
    expect(parsed).toEqual(file);
  });

  it("rejects foreign or malformed JSON", () => {
    expect(parseSaveFile("{}")).toBeNull();
    expect(parseSaveFile("not json")).toBeNull();
    expect(parseSaveFile(JSON.stringify({ app: "other", v: 1 }))).toBeNull();
  });
});
