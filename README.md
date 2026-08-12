# LowDrag RTS

A heightmap-based real-time strategy game inspired by Total Annihilation, built with TypeScript, Three.js, and Webpack. Runs entirely in the browser. Hobby project, worked on in sessions as time allows.

Procedurally generated terrain with a synthwave visual style — neon height-ramped grid, bloom/tone-mapping post-processing, and a dynamic day/night sun with reflective terrain glint.

## Status

**Phase 2 (terrain) is essentially complete.** Procedural heightmap terrain, a unified visual/build grid, plateau build-sites, region-masked flatland/mountain zoning, rotatable valley carving, and a full synthwave visual pass (bloom, dynamic lighting, terrain reflections) are all in and working.

**No units, combat, projectiles, or resources yet.** A full game-simulation architecture (multiplayer-first, deterministic fixed-tick sim, SoA unit data for 300+ unit scale) is planned for Phase 3 onward — see `Main-GamePlan12-08-2026.md` for the authoritative plan and `CLAUDE.md` for current implementation notes.

### Known issues
- 🟡 A small amount of sun-glint bleed remains at some panel edges. The major forward/back-glint issue is fixed and live-tested; this remaining visual polish is not blocking gameplay work.

## Requirements
- Node.js and npm (any reasonably recent LTS version)

## Setup

```bash
npm install
```

## Running it

```bash
npm start
```

Starts the Webpack dev server and opens the game in your browser at **http://localhost:9000**. Live-reloads on file changes.

A standalone noise visualiser (for tuning terrain generation parameters in isolation) is also served at **http://localhost:9000/noise-visualizer.html**.

## Building

```bash
npm run build
```

Produces a production bundle at `public/bundle.js`.

## Verification

```bash
npm run verify
```

This runs the full TypeScript check, isolated simulation check, 19 automated tests, and a production build. Use `npm test` for tests only or `npm run test:watch` while coding.

## Controls (current build)

- **Orbit / pan / zoom** — mouse drag / right-drag / scroll (Three.js `OrbitControls`)
- Several draggable debug panels are shown by default (Terrain Shape, Grid Appearance, Terrain Controls, Save/Load Settings, Performance Monitor) — these are the current dev-facing controls for tuning terrain generation, lighting, and reflections live. Panel positions persist across reloads; a "Reset Panel Positions" button is in the Save/Load Settings panel.
- Save/Load Settings panel exports the whole tunable scene (terrain shape, seed, grid colours, reflection/sun params) as JSON, and can re-import it.

## Tech stack

- **TypeScript** (strict mode)
- **Three.js** — 3D rendering
- **Webpack 5** — bundler + dev server
- **fastnoise-lite** — procedural terrain noise (OpenSimplex2S + domain warp)
- **postprocessing** (pmndrs) — bloom, ACES tone mapping, colour grading

## Project structure

See `Main-GamePlan12-08-2026.md` for architecture and phases, and `CLAUDE.md` for the annotated source tree and current-session rules. Short version:

```
src/
├── sim/           # Deterministic game-sim core (Phase 3+, Three.js-free by design)
└── engine/
    ├── Game.ts        # Orchestrator — scene, renderer, render loop
    ├── config/        # Tunable parameter objects (terrain, lighting, camera)
    ├── terrain/        # Heightmap generation, grid, materials/shaders, lighting
    ├── ui/            # Debug/tuning control panels
    ├── debug/         # Performance monitor
    └── utils/         # Noise sampling, buffer pooling
```

## Development notes

This repo carries `Main-GamePlan12-08-2026.md` as the authoritative roadmap and `CLAUDE.md` as the current implementation log/context for AI-assisted coding sessions. Files under `docs/` with historical banners are reference material only.

## License

ISC
