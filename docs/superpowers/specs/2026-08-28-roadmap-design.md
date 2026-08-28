# MDSolids Web — 2026-08 Roadmap Design

Approved scope: unit-system toggle, shareable URLs, worked examples, print/export,
save/load, mobile navigation, PWA, accessibility pass, and three new modules
(beam deflection, combined loading, strain transformation).

## Foundation: module state API

Module state currently lives in closures inside `mount()`. Shareable URLs,
save/load, examples, and the unit toggle all need state in/out, so `ModuleDef`
gains an optional richer mount signature and examples list:

```ts
export interface ModuleContext {
  /** Opaque state to restore. Modules MUST validate before applying. */
  initialState?: unknown;
  /** Call from redraw() with the module's current serializable state. */
  reportState(state: unknown): void;
}

interface ModuleDef {
  // ...existing fields...
  examples?: { title: string; state: unknown }[];
  mount(root: HTMLElement, ctx?: ModuleContext): void | (() => void);
}
```

- Modules own their state schema (plain JSON). The shell never inspects it.
- `reportState` is debounced by the shell into the URL via
  `history.replaceState` (no history spam; doesn't fire `hashchange`).
- A module that ignores `ctx` still works — the API is opt-in, but all 11
  modules will adopt it.

## Shareable URLs

`#/<module-id>?s=<base64url(JSON state)>`. The shell parses `s` on route
render and passes it as `initialState`. A **Copy link** toolbar button copies
the current URL. Invalid/corrupt state must be ignored gracefully (module
falls back to defaults).

## Worked examples

`ModuleDef.examples` drives an **Examples** dropdown in the module toolbar.
Selecting one re-mounts the module with `initialState = example.state`.
Each module ships 2–3 textbook-style examples.

## Save / load

- **Save** downloads `{ app: "mdsolids-web", v: 1, module: <id>, state }` as
  `.json`.
- **Open** reads such a file, routes to the module, mounts with the state.
- No localStorage persistence (YAGNI — files + URLs cover the classroom flows).

## Unit system toggle

Modules stay unit-agnostic (contract rule: never hard-code a unit system into
the math). New `src/core/units.ts`:

- Three **self-consistent label sets** so displayed units are always valid for
  the unconverted numbers:
  - `generic`: len, force, force/len², force·len, len², len⁴, force/len
  - `SI`: mm, N, MPa (= N/mm²), N·mm, mm², mm⁴, N/mm
  - `US`: in, lb, psi, lb·in, in², in⁴, lb/in
- `UnitKind = "length" | "force" | "stress" | "moment" | "distLoad" | "area" |
  "inertia" | "angleRad" | "angleDeg" | "none"` (stress also serves moduli).
- `u(kind): string` returns the current label. Modules use `u("stress")`
  instead of literal `"force/len²"`.
- Current system persists in `localStorage`. Toolbar select toggles it; the
  shell **re-mounts the active module** with its last reported state so labels
  refresh. Values are NOT converted (documented in the UI hint); label sets
  being self-consistent keeps the math honest. Field-level conversion can be
  added later without breaking this design.

## Print / export

- `@media print` styles: hide sidebar/toolbar/buttons, light background, black
  text, single-column layout.
- **Print** toolbar button calls `window.print()`. Browsers' "Save as PDF"
  covers PDF export.

## Mobile navigation

Today ≤900px hides the sidebar with no replacement (cannot navigate). Fix:

- A topbar (brand + ☰ button) shown only ≤900px.
- ☰ toggles the sidebar as an overlay drawer; selecting a module closes it.
- Canvas containers scale down (`max-width: 100%` already present; ensure
  module grids collapse to one column — already done).

## PWA

- `public/manifest.webmanifest`: name, colors (Dracula bg `#212029`), SVG icon.
- `public/sw.js`: same-origin GET, network-first with cache fallback; caches
  successful responses at runtime (works with Vite's hashed asset names).
- Registered from `main.ts` only when `import.meta.env.PROD`, scoped to
  `import.meta.env.BASE_URL` (works at `/` on Vercel and `/mdsolids/` on Pages).

## Accessibility

- Skip-to-content link; `aria-label` on nav; `aria-current="page"` on the
  active nav item; toolbar controls are real labelled elements.
- Module canvases get `role="img"` + descriptive `aria-label`.
- Results column wrapped in `aria-live="polite"`.

## New modules (per MODULE_CONTRACT.md, isolated folders)

1. **beam-deflection** (Beams): elastic curve v(x) for simply-supported or
   cantilever prismatic beams under point loads + uniform distributed segments.
   Numerical double integration of M(x)/EI with boundary-condition solve; tests
   against closed forms (PL³/48EI, 5wL⁴/384EI, PL³/3EI, wL⁴/8EI).
2. **combined-loading** (Stress & Strain): circular shaft (solid/hollow) under
   axial P, torque T, bending M → σ_axial, σ_bending, τ_torsion at the surface
   point, combined plane-stress state → principal stresses, τ_max. No imports
   from other modules (contract).
3. **strain-transform** (Stress & Strain): plane-strain transformation
   (εx, εy, γxy, θ), principal strains, max shear strain, Mohr's circle for
   strain; rosette mode (rectangular 45° and delta 60°) solving gauge readings
   → strain state.

All three: pure `compute.ts` + ≥3 hand-checkable tests + `index.ts` UI using
the new ctx/units/examples APIs.

## Execution plan

1. Core: types/units/shell toolbar/state routing/print CSS/mobile nav/PWA/a11y.
2. Reference retrofits (torsion, section-properties) establishing the pattern.
3. Parallel agents: retrofit axial, beam, truss, column, stress-transform,
   pressure-vessel; build the 3 new modules.
4. Integrate (register new modules), `npm test` + `npm run build` green,
   code review pass, README update.
5. Merge to main, push (deploys GitHub Pages), create Vercel project.
