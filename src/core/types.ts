/**
 * The Module contract.
 *
 * Every analysis module (axial, torsion, beam, truss, ...) implements `ModuleDef`.
 * Modules are pure UI+compute units: given a root element, they render their own
 * form and results. They MUST NOT touch global state, the router, or other modules.
 *
 * Keep physics/math in a separate `compute.ts` as PURE functions (no DOM) so they
 * can be unit-tested. The `mount` function wires those pure functions to the DOM.
 */
/**
 * Passed to `mount` by the shell. Lets a module restore serialized state
 * (shared URLs, saved files, worked examples) and report its current state
 * back so the shell can keep the share-URL fresh.
 */
export interface ModuleContext {
  /** Opaque state to restore. Modules MUST validate before applying. */
  initialState?: unknown;
  /** Call from redraw() with the module's current JSON-serializable state. */
  reportState(state: unknown): void;
}

/** A named, loadable input set shown in the shell's Examples dropdown. */
export interface Example {
  title: string;
  state: unknown;
}

export interface ModuleDef {
  /** Stable kebab-case id, also used as the URL hash route. e.g. "section-properties" */
  id: string;
  /** Human title shown in the sidebar and header. */
  title: string;
  /** Grouping shown in the sidebar. One of the CATEGORIES below. */
  category: Category;
  /** One-sentence summary shown on cards and the home page. */
  description: string;
  /** Single emoji or short glyph used as the module icon. */
  icon: string;
  /** Worked examples loadable from the shell toolbar. */
  examples?: Example[];
  /**
   * Render the module into `root`. `root` is empty and owned by the module.
   * `ctx` (when provided) carries initial state and a reportState callback.
   * Return an optional cleanup function called when navigating away.
   */
  mount(root: HTMLElement, ctx?: ModuleContext): void | (() => void);
}

export type Category =
  | "Geometry"
  | "Axial & Torsion"
  | "Beams"
  | "Structures"
  | "Stress & Strain";

export const CATEGORIES: Category[] = [
  "Geometry",
  "Axial & Torsion",
  "Beams",
  "Structures",
  "Stress & Strain",
];
