# Plan — Cross-platform MDSolids

## Goal
Replace the Windows-only MDSolids with a free, open-source, **browser-based**
mechanics-of-materials toolkit, deployed to GitHub Pages.

## Requirements analysis
- **Original:** Windows desktop app (T.A. Philpot). Modules: section properties,
  axial, torsion, beams (shear/moment), trusses, columns, pressure vessels,
  stress transformation / Mohr's circle.
- **Constraints:** must run on macOS/Linux/Windows → target the browser. Must be
  free + open-source. Must host on GitHub Pages → fully static, hash-routed.
- **Non-goals:** binary-faithful clone or reuse of original assets/code. This is a
  clean-room reimplementation of the analyses.

## Tech decisions
- Vite + TypeScript, **no runtime deps** (pure DOM + canvas) → tiny, fast, easy to
  host and audit.
- Module-registry architecture so work is **shardable**: each module is an isolated
  folder implementing `ModuleDef` (see `MODULE_CONTRACT.md`).
- Vitest for the pure compute layer — engineering correctness is testable.
- Dracula Pro theme.

## Orchestration
1. ✅ Core scaffold (shell, router, registry, DOM/plot/math helpers, theme).
2. ✅ Reference module `section-properties` (sets the pattern) + tests.
3. ⏳ Fan out the remaining 7 modules to **parallel Hermes agents**, each building
   `compute.ts` + `compute.test.ts` + `index.ts` in isolation against the contract.
4. ⏳ Integrate, wire the registry, `npm run build` + `npm test` green.
5. ⏳ `/code-review` pass → refactor.
6. ⏳ GitHub Actions → GitHub Pages deploy.

## Modules & status — all 8 complete (54 unit tests passing)
- [x] Section Properties (reference, Claude)
- [x] Axial Deformation (Hermes compute+tests, Claude UI)
- [x] Torsion (Hermes)
- [x] Beam Diagrams (Hermes)
- [x] Truss Analysis (Hermes compute+tests, Claude UI)
- [x] Column Buckling (Hermes)
- [x] Stress Transformation / Mohr's circle (Hermes)
- [x] Pressure Vessels (Hermes)
