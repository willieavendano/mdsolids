# MDSolids Web

An open-source, **cross-platform** (runs in any browser) reimagining of
[MDSolids](https://static-archives.git-pages.mst.edu/mdsolids/) — the classic
Windows-only educational software for **Mechanics of Materials** by T.A. Philpot.

This is an independent, clean-room reimplementation of the *kinds of analyses*
MDSolids offers, built as a modern interactive web app. It is **not** affiliated
with or derived from the original software.

🔗 **Live app:** https://willieavendano.github.io/mdsolids/

## Modules

| Module | What it does |
|---|---|
| **Section Properties** | Area, centroid, Iₓ/I_y, polar J, radii of gyration of composite sections |
| **Axial Deformation** | Normal stress and elongation of segmented axially-loaded bars |
| **Torsion** | Shear stress and angle of twist in circular shafts |
| **Beam Diagrams** | Reactions, shear-force & bending-moment diagrams |
| **Beam Deflection** | Elastic curve, max deflection & slope by numeric integration of M/EI |
| **Truss Analysis** | Member forces in pin-jointed trusses (method of joints) |
| **Column Buckling** | Euler critical load, slenderness, buckling stress |
| **Stress Transformation** | Plane-stress transforms, principal stresses, interactive Mohr's circle |
| **Strain Transformation** | Plane-strain transforms, principal strains, 45°/60° rosettes |
| **Combined Loading** | Shaft under axial + torsion + bending → principal stresses |
| **Pressure Vessels** | Hoop & longitudinal stress in thin-walled vessels |

## Classroom features

- **Shareable links** — every problem's inputs live in the URL. *Copy link* and
  send a pre-loaded problem to students.
- **Worked examples** — each module has a *Load example* dropdown with
  textbook-style input sets.
- **Save / Open** — download a problem as a small `.json` file and reopen it
  later (or turn it in).
- **Unit systems** — toggle input/result labels between generic, SI
  (mm · N · MPa), and US (in · lb · psi) sets. Labels only; values are never
  converted, and each set is self-consistent.
- **Print** — a print-friendly report of the current module (use your
  browser's *Save as PDF*).
- **Works offline** — installable PWA; after the first visit it runs without a
  connection. Usable on phones via the collapsible sidebar.

## Tech

- **Vite + TypeScript**, zero runtime dependencies — pure DOM + `<canvas>`.
- Dracula Pro (Van Helsing) theme.
- Pure compute functions are unit-tested with **Vitest** against textbook values.
- Static site with hash routing — deploys anywhere (GitHub Pages via Actions,
  Vercel, any static host).

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # run the unit tests
npm run build    # type-check + production build to dist/
```

## Architecture

The app is a registry of self-contained **modules**. Each lives in
`src/modules/<id>/` with pure math in `compute.ts` (+ `compute.test.ts`) and UI in
`index.ts`. The core (`src/core/`) provides the shell/router, DOM helpers, a small
linear-algebra kit, and a themed `<canvas>` plotting library. New modules implement
the `ModuleDef` contract — see [`MODULE_CONTRACT.md`](./MODULE_CONTRACT.md) and the
`section-properties` reference module.

This project was built collaboratively by an orchestrating agent (Claude) and a
fleet of local [Hermes](https://github.com/) build agents, each implementing one
module in parallel against the shared contract.

## Contributing

PRs welcome — add a module, improve the physics, or expand the test coverage.
Follow the contract, keep `compute.ts` pure and tested, and run `npm run build`
+ `npm test` before opening a PR.

## The original MDSolids

This project is inspired by **MDSolids**, the Windows educational software for
Mechanics of Materials created by **Dr. Timothy A. Philpot** (Missouri University
of Science and Technology), winner of the 1998 Premier Award for Excellence in
Engineering Education Courseware.

- 🪟 **Original MDSolids:** https://static-archives.git-pages.mst.edu/mdsolids/
- 📘 Companion textbook: *Mechanics of Materials: An Integrated Learning System* by T.A. Philpot
- 🎞️ Related: [MecMovies](https://web.mst.edu/~mecmovie/)

MDSolids Web is an independent, clean-room reimplementation of the *kinds of
analyses* MDSolids offers. It is **not** affiliated with, endorsed by, or derived
from the original software or its author — all credit for the original concept and
its decades of impact on engineering education belongs to Dr. Philpot.

## License

[MIT](./LICENSE) © 2026 Willie Avendano. Educational use encouraged.
