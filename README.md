# LowDrag RTS

A heightmap-based real-time strategy game inspired by Total Annihilation, built with TypeScript, Three.js, and Webpack. Runs entirely in the browser. Hobby project, worked on in sessions as time allows.

Procedurally generated terrain presented as a closed terrain chunk, with a synthwave visual style — neon height-ramped grid, bloom/tone-mapping post-processing, and a dynamic day/night sun with reflective terrain glint.

## Status

**Phase 2 terrain and Phase 2.5 stabilisation are complete.** Procedural heightmap terrain, a closed wall-and-base terrain chunk with metallic violet sides and a matching side grid, a unified visual/build grid, plateau build-sites, region-masked flatland/mountain zoning, rotatable valley carving, camera collision, settings/sharing, automated verification, and the full synthwave visual pass are in and working.

**No units, combat, projectiles, or resources yet.** The next task is Phase 3A: a minimal Three.js-free deterministic fixed-tick simulation with commands, replay/checksums and a small SoA-style unit store. See `Main-GamePlan12-08-2026.md` for the authoritative plan and `CLAUDE.md` for current implementation notes.

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

This runs the full TypeScript check, isolated simulation check, automated tests, and a production build. Use `npm test` for tests only or `npm run test:watch` while coding.

## Controls (current build)

- **Orbit / pan / zoom** — mouse drag / right-drag / scroll (Three.js `OrbitControls`). Swept collision stops zoom/orbit from entering terrain; pan input near the surface slides across it and automatically follows terrain height up and down.
- Several draggable debug panels are shown by default (Terrain Shape, Grid Appearance, Terrain Controls, Share/Save Settings, Performance Monitor). Use the arrow in any title bar to roll that panel down to its title only; it remains draggable. Positions and collapsed states persist across reloads, with a "Reset Panel Layout" button in Share/Save Settings.
- Save/Load Settings panel exports the whole tunable scene (terrain shape, seed, grid colours, reflection/sun params) as JSON, and can re-import it.
- The same panel shows the current 32-bit Terrain Seed and provides versioned Lighting Codes (`LDR-L1-…`) and Full Scene Codes (`LDR-S1-…`) for easy sharing. A terrain seed uses the recipient's current terrain sliders; a Full Scene Code reproduces all sliders as well.

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
