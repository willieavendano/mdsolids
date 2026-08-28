/**
 * Unit-system display labels.
 *
 * Modules are unit-agnostic: the math never assumes a unit system (see
 * MODULE_CONTRACT.md). What the toggle changes is the *labels* shown next to
 * inputs and results. Each set is self-consistent (e.g. SI uses mm-N, so
 * stress is N/mm² = MPa), so any numbers entered in that system produce
 * results correctly described by the same system's labels. Values are never
 * converted when switching — the shell re-mounts the module so labels refresh.
 */

export type UnitSystemId = "generic" | "si" | "us";

export type UnitKind =
  | "length"
  | "area"
  | "inertia" // second moment of area, len⁴
  | "force"
  | "moment" // force·len
  | "distLoad" // force per length
  | "stress" // also elastic/shear moduli
  | "angleRad"
  | "angleDeg"
  | "strain"
  | "none";

const LABELS: Record<UnitSystemId, Record<UnitKind, string>> = {
  generic: {
    length: "len",
    area: "len²",
    inertia: "len⁴",
    force: "force",
    moment: "force·len",
    distLoad: "force/len",
    stress: "force/len²",
    angleRad: "rad",
    angleDeg: "deg",
    strain: "ε",
    none: "",
  },
  si: {
    length: "mm",
    area: "mm²",
    inertia: "mm⁴",
    force: "N",
    moment: "N·mm",
    distLoad: "N/mm",
    stress: "MPa",
    angleRad: "rad",
    angleDeg: "deg",
    strain: "ε",
    none: "",
  },
  us: {
    length: "in",
    area: "in²",
    inertia: "in⁴",
    force: "lb",
    moment: "lb·in",
    distLoad: "lb/in",
    stress: "psi",
    angleRad: "rad",
    angleDeg: "deg",
    strain: "ε",
    none: "",
  },
};

export const UNIT_SYSTEMS: { id: UnitSystemId; label: string }[] = [
  { id: "generic", label: "Generic units" },
  { id: "si", label: "SI (mm · N · MPa)" },
  { id: "us", label: "US (in · lb · psi)" },
];

const STORAGE_KEY = "mdsolids.units";

let current: UnitSystemId = "generic";
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "generic" || saved === "si" || saved === "us") current = saved;
} catch {
  /* private-mode localStorage may throw; keep default */
}

export function unitSystem(): UnitSystemId {
  return current;
}

export function setUnitSystem(id: UnitSystemId): void {
  current = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Label for a physical kind in the current unit system, e.g. u("stress") → "MPa". */
export function u(kind: UnitKind): string {
  return LABELS[current][kind];
}
