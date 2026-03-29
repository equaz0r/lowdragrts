# Project: LowDrag RTS

## What This Is
A voxel-based real-time strategy game inspired by Total Annihilation. Built with TypeScript, Three.js, and Webpack. Rendered in the browser. Hobby project — worked on in sessions when time allows.

## Current Status
✅ **Compiles cleanly. Builds successfully. No TypeScript errors.**

This branch (`main`, promoted from `state-machine-implementation`) is a **terrain/rendering/engine branch**. It does NOT contain units, combat, projectiles, or a resource system. Those existed in `old-main` (the previous main branch) but are not present here. The focus of this branch has been the visual engine — terrain, lighting, reflections, and performance.

The `old-main` branch on GitHub contains the combat and unit code if needed for reference.

## Tech Stack
- **TypeScript** (strict mode, ES6 target)
- **Three.js** (3D rendering)
- **Webpack 5** (bundler + dev server)
- **simplex-noise** (procedural terrain generation)
- **postprocessing** (loaded, not yet used)
- **dat.gui** (loaded, not yet used in production)

## Architecture

### Entry Points
- `src/main.ts` → imports and initializes `Game`
- `src/index.ts` → exports `Game` class
- `src/engine/Game.ts` → main game class, creates scene/camera/renderer, runs loop

### Key Directories & Files
```
src/
├── index.ts / main.ts              # Entry points
├── engine/
│   ├── Game.ts                     # Main game loop and system orchestration
│   ├── config/
│   │   └── GameParameters.ts       # ALL tunable parameters in one place
│   ├── terrain/
│   │   ├── TerrainGenerator.ts     # Procedural voxel terrain mesh + shader injection + valley carving
│   │   ├── GridSystem.ts           # 4000-unit grid with observer pattern
│   │   └── LightingSystem.ts       # Sun, sky, halo, day/night cycle
│   ├── ui/
│   │   ├── ReflectionControls.ts   # In-game sliders for terrain/sun params (top-right)
│   │   └── TerrainControls.ts      # Terrain shape sliders + Regenerate button (top-left)
│   ├── debug/
│   │   └── PerformanceMonitor.ts   # FPS, frame time, draw calls, memory overlay
│   ├── utils/
│   │   └── BufferPool.ts           # Singleton memory pool for geometry buffers
│   └── shaders/
│       ├── ShaderManager.ts        # Shader manager (defined but not actively used — legacy)
│       ├── skybox.vert / .frag     # Sky rendering shaders
│       └── sunHalo.vert / .frag    # Sun halo shaders
└── types/
    ├── postprocessing.d.ts         # Type declarations for postprocessing lib
    └── simplex-noise-esm.d.ts      # Type declarations for simplex noise
```

### World Dimensions
- Grid: 100 divisions × 64 units/cell = 4,000 × 4,000 world units
- Terrain height: 0–1400 units default (HEIGHT_SCALE in TerrainConfig / GameParameters)
- Camera starts at (200, 200, 200), looking at origin

## What's Working
- ✅ Procedural terrain generation (Simplex noise, 6–8 octaves, height-based vertex colours)
- ✅ Dynamic lighting system (sun orbit, sky gradient, halo, colour transitions at sunrise/sunset)
- ✅ Terrain reflection shader (panel effect, metalness/roughness driven by sun angle, height, view angle)
- ✅ Edge geometry (coloured grid lines over terrain surface)
- ✅ OrbitControls camera (pan, zoom, rotate with damping and constraints)
- ✅ Interactive parameter sliders (ReflectionControls panel, top-right)
- ✅ TerrainControls panel (top-left) — live sliders for height, persistence, base/peak blend, valley width/depth + Regenerate button
- ✅ Valley carving — Gaussian mask along X axis cuts a readable corridor through the terrain
- ✅ Performance monitor overlay (FPS graph, draw calls, memory — bottom-left)
- ✅ Buffer pooling (prevents GC spikes from geometry reuse)
- ✅ Cardinal direction coordinate markers on terrain

## What's NOT Implemented (yet)
- ❌ Units (no Unit.ts, UnitManager.ts)
- ❌ Combat / projectiles
- ❌ Resource system (Skirulum, Vlux, Fredalite, Scrap)
- ❌ Buildings / production
- ❌ Pathfinding / AI
- ❌ Minimap
- ❌ Win/lose conditions
- ⚠️ postprocessing library: imported, not yet wired up
- ⚠️ dat.gui: dependency present, not used in production UI
- ⚠️ ShaderManager.ts: defined but superseded by onBeforeCompile injection in TerrainGenerator

## Do Not Touch
- TerrainGenerator.ts — fragile shader injection via `onBeforeCompile`; the reflection system depends on precise uniform setup
- LightingSystem.ts — sun/halo/sky system is carefully tuned; colour transitions are parameter-driven
- BufferPool.ts — used by TerrainGenerator; changes risk memory leaks

## Singleton Rules
- `LightingSystem` and `PerformanceMonitor` are singletons — always use `getInstance()`, never `new` directly
- Both clear their static instance in `dispose()` so HMR creates a fresh instance correctly
- `Game.dispose()` stops the animate() loop (`disposed` flag), removes the resize listener, and disposes all singletons in order

## Development Commands
```bash
npm install       # First time setup
npm start         # Webpack dev server (auto-opens browser, hot reload)
npm run build     # Production bundle → public/bundle.js
```

## Phase Plan

### Phase 1 — Stabilise ✅ DONE
- TypeScript compiles clean, webpack builds, code quality high

### Phase 2 — Terrain Improvement ⚠️ IN PROGRESS
**Goal**: More dramatic, readable terrain — tall mountains, deep valleys, gradual slopes. No jagged spikes.

**Done so far:**
- ✅ TerrainControls UI panel with live sliders and Regenerate button
- ✅ Valley carving via Gaussian mask (configurable width/depth)
- ✅ Tuned defaults: HEIGHT_SCALE 1400, PERSISTENCE 0.5, BASE_NOISE_FREQUENCY 0.15, smoother angular blend

**TerrainConfig (live, on TerrainGenerator.config):**
- `heightScale` — overall amplitude (default 1400)
- `persistence` — octave contribution, lower = smoother (default 0.5)
- `basePeakBlend` — 0 = pure peaks, 1 = pure rolling base (default 0.6)
- `valleyEnabled` — toggle valley carving
- `valleyWidth` — fraction of map width (default 0.18)
- `valleyDepth` — 0 = no effect, 1 = flat floor (default 0.72)

**Definition of done:** At least one clearly readable valley/river corridor, mountain peaks feel tall and dramatic, slopes are walkable-looking (not cliffs everywhere). Still needs visual testing and tuning.

### Phase 3 — Add Units
- Basic `Unit` class (mesh, position, selection state)
- `UnitManager` (spawn, select, move)
- Click-to-select and right-click-to-move on terrain surface
- Unit health bar

### Phase 4 — Combat
- Line of sight checks
- Projectile system (pooled)
- Damage and death

### Phase 5 — Resource System
- **Skirulum**: blue/purple terrain formations harvested by vehicles + foundry processing
- **Vlux**: energy from solar concentrators; day/night cycle affects rate (visual system already exists)
- **Fredalite**: rare crystals, finite, collector buildings, 10-tile spacing
- **Scrap**: auto-collected by units walking over wreckage, converts 10:1 to Skirulum/Vlux
- Resource UI: numerical display + rates

### Phase 6 — Buildings & Production
- Free placement (Total Annihilation style)
- Factory with unit queue (max 30)
- Builder units (multiple builders = faster construction)
- Basic tech tree

### Phase 7 — AI & Polish
- Pathfinding
- Basic enemy AI
- Formation movement
- Minimap
- Save/load

## Resource Design Reference
- **Skirulum** — primary construction material, blue/purple voxel formations
- **Vlux** — energy, solar nodes, day/night modulated (visual system already exists in LightingSystem)
- **Fredalite** — rare crystals, finite surface deposits, collector buildings
- **Scrap** — from wreckage, instant collection on contact, 10:1 to Skirulum/Vlux

## Session Log
| Date | Branch | What Was Done |
|------|--------|---------------|
| Early 2025 | old-main | Core engine, units, combat, projectile/LoS fixes |
| Mar 2025 | feature/tron-aesthetic | Bloom, edge detection, visual polish |
| Mar–Apr 2025 | state-machine-implementation | Terrain rebuild, lighting system, buffer pooling, performance monitor |
| Mar 2026 | main | Promoted state-machine-implementation to main; regenerated CLAUDE.md |
| 28 Mar 2026 | main | Phase 2 in progress: TerrainControls UI, valley carving, tuned defaults; committed and pushed to origin/main |
| 29 Mar 2026 | main | Architecture audit + hardening: LightingSystem.dispose() now clears static instance (was causing HMR dead-instance reuse); constructor guard changed from silent no-op to throw; Game animate loop gets disposed flag to stop on dispose(); resize listener stored and removed on dispose. |
| 29 Mar 2026 | main | Fixed terrain sliders/Regenerate having no visible effect. Root cause: index.ts was instantiating Game as a side effect of being imported by main.ts — two Game instances, two scenes, two animate() loops; first instance always won the canvas. Fix: index.ts now only re-exports Game; main.ts owns the single instance. Also fixed: vertex colour and edge line normalisation changed from relative (per-terrain min/max) to absolute (against heightScale) so parameter changes are visually apparent. HMR cleanup added to main.ts. |

---
*Update this file at the end of every coding session.*
*Claude Code reads this automatically at session start.*
