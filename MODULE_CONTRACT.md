# MDSolids Web — Module Contract

Every analysis module is a self-contained folder under `src/modules/<id>/` with:

- `compute.ts` — **pure** functions (NO DOM, NO imports from other modules). All
  physics/math lives here so it can be unit-tested.
- `compute.test.ts` — Vitest tests for the pure functions, with known textbook
  answers. Import from `vitest`: `import { describe, it, expect } from "vitest"`.
- `index.ts` — exports `default` a `ModuleDef` that renders the UI.

## The `ModuleDef` interface (`src/core/types.ts`)

```ts
export interface ModuleDef {
  id: string;          // kebab-case, equals folder name & URL route
  title: string;       // e.g. "Torsion of Circular Shafts"
  category: Category;  // "Geometry" | "Axial & Torsion" | "Beams" | "Structures" | "Stress & Strain"
  description: string; // one sentence
  icon: string;        // single emoji/glyph
  examples?: Example[]; // { title, state } — shown in the shell's Examples dropdown
  mount(root: HTMLElement, ctx?: ModuleContext): void | (() => void);
}

export interface ModuleContext {
  initialState?: unknown;             // restore this state (validate first!)
  reportState(state: unknown): void;  // call from redraw() with current state
}
```

## State (share URLs / save files / examples)

Each module defines a small JSON-serializable state object holding its inputs
(e.g. `{ segments: [...] }`). The shell mirrors it into the URL and save files.

- In `mount`, restore from `ctx?.initialState` through a local `readState(raw)`
  validator that returns `null` unless every field is a finite number of the
  right shape — never trust the payload (it comes from URLs/files).
- At the top of `redraw()`, call `ctx?.reportState({...})` with a *copy* of the
  current inputs.
- Provide 2–3 `examples` with realistic textbook-style values (state objects in
  the same schema). Label the titles with the intended unit flavor, e.g.
  "Stepped steel shaft (SI: mm, N)".

See `src/modules/torsion/index.ts` for the complete pattern.

## Unit labels

Import `u` from `../../core/units` and use it for every input/result unit and
plot axis label instead of hard-coded strings: `u("length") | "area" |
"inertia" | "force" | "moment" | "distLoad" | "stress" | "angleRad" |
"angleDeg" | "strain" | "none"`. The user's unit-system choice (generic / SI /
US) swaps the labels; values are never converted, so the math must remain
unit-agnostic as before.

## Accessibility

- Create canvases with `el("canvas", { role: "img", "aria-label": "<what the
  chart shows>" })`.
- Wrap the results container with `aria-live="polite"`
  (`el("div", { "aria-live": "polite" })`).

## Available helpers — import ONLY from `../../core/*`

From `../../core/dom`:
- `el(tag, attrs, ...children)` — create elements. `attrs` supports `class`, `html`,
  `onClick`/`onInput`/`onChange` (event handlers), `style`, and plain attributes.
- `numberField({label, value, unit?, step?, min?, max?, onInput})` → labelled input.
- `selectField({label, value, options:[{value,label}], onChange})`.
- `card(title, ...children)` → titled panel. `result(label, value, unit?)` → result row.
- `fmt(n, sig=4)` → engineering-formatted number string.

From `../../core/plot`:
- `new Plot(canvasEl, cssW, cssH)`, then `.setBounds({xMin,xMax,yMin,yMax})`,
  `.clear()`, `.axes(xLabel, yLabel, ticks?)`, `.line(points, color, width?)`,
  `.fillToZero(points, posColor, negColor)`, `.dot(x,y,color,r?)`,
  `.label(x,y,text,color?)`, `.project(x,y) → [px,py]`, and `.ctx` for raw drawing.
- `PALETTE` — `.bg .grid .axis .text .muted .series[] .fillPos .fillNeg`.

From `../../core/math` (if needed):
- `solveLinearSystem(A, b) → number[] | null`, `clamp`, `lerp`, `rad`, `deg`.

## Style / UX conventions

- Two-column layout: the module body grid is already 2 columns. Append exactly two
  top-level children to `root`: a **left** controls/results column and a **right**
  visualization column (canvas). See `section-properties/index.ts` as the template.
- Recompute & redraw on every input change (call a local `redraw()`).
- Keep numeric output via `fmt()`. State units as generic ("len", "force") OR offer
  a unit selector — but never hard-code a unit system into the math.
- Dracula Pro theme is global; use the provided CSS classes, don't inline colors
  except via `PALETTE` when drawing on canvas.

## Correctness bar

- Validate against standard textbook formulas. Include at least 3 meaningful tests
  with hand-checkable numbers.
- Guard divide-by-zero and singular cases; show a `.warn` message instead of NaN.

## Do NOT

- Touch the router, `registry`, global state, `index.html`, or other modules' files.
- Add npm dependencies. Everything is vanilla TS + the core helpers above.
- Use a framework (no React/Vue). Plain DOM via `el()`.

See `src/modules/section-properties/` for a complete worked example.
