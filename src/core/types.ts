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
  /**
   * Render the module into `root`. `root` is empty and owned by the module.
   * Return an optional cleanup function called when navigating away.
   */
  mount(root: HTMLElement): void | (() => void);
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
