/**
 * Serialization of module state for share URLs and save/load files.
 *
 * URL form: #/<module-id>?s=<base64url(JSON)>. File form: a small JSON
 * envelope so saved problems are self-describing. State itself is opaque —
 * each module validates what it accepts.
 */

/** Encode a JSON-serializable value as base64url (URL-safe, no padding). */
export function encodeState(state: unknown): string | null {
  try {
    const json = JSON.stringify(state);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return null;
  }
}

/** Decode a base64url payload back to a value. Returns undefined on any error. */
export function decodeState(payload: string): unknown {
  try {
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

/** Split a location.hash into module id and decoded state (if any). */
export function parseHash(hash: string): { id: string; state?: unknown } {
  const raw = hash.replace(/^#\/?/, "");
  const q = raw.indexOf("?");
  if (q === -1) return { id: raw };
  const id = raw.slice(0, q);
  const params = new URLSearchParams(raw.slice(q + 1));
  const s = params.get("s");
  return { id, state: s ? decodeState(s) : undefined };
}

/** Build a hash for a module, embedding state when it encodes cleanly. */
export function buildHash(id: string, state?: unknown): string {
  if (state !== undefined) {
    const s = encodeState(state);
    if (s) return `#/${id}?s=${s}`;
  }
  return `#/${id}`;
}

export interface SaveFile {
  app: "mdsolids-web";
  v: 1;
  module: string;
  state: unknown;
}

export function makeSaveFile(module: string, state: unknown): SaveFile {
  return { app: "mdsolids-web", v: 1, module, state };
}

export function parseSaveFile(text: string): SaveFile | null {
  try {
    const data = JSON.parse(text);
    if (
      data &&
      data.app === "mdsolids-web" &&
      data.v === 1 &&
      typeof data.module === "string" &&
      "state" in data
    ) {
      return data as SaveFile;
    }
  } catch {
    /* fall through */
  }
  return null;
}
