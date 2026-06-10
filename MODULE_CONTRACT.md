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
  mount(root: HTMLElement): void | (() => void); // render into root; optional cleanup
}
```

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
