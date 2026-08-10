# Project: LowDrag RTS

## What This Is
A heightmap-based real-time strategy game inspired by Total Annihilation. Built with TypeScript, Three.js, and Webpack. Rendered in the browser. Hobby project — worked on in sessions when time allows.

## Current Status
✅ **Compiles cleanly. Builds successfully. No TypeScript errors.**

This branch (`main`) is the **terrain/rendering/engine branch**. No units, combat, projectiles, or resources yet. Focus is the visual engine and pre-Phase-3 gameplay architecture.

The old combat/unit code lives in history at commit `3b6eeea` ("Improved combat system") — the `old-main` branch itself was deleted 10 Aug 2026 (fully merged into `main`'s lineage already, checked out via `git log 3b6eeea` if needed).

## Tech Stack
- **TypeScript** (strict mode, ES6 target)
- **Three.js** (3D rendering)
- **Webpack 5** (bundler + dev server)
- **fastnoise-lite** (procedural terrain — OpenSimplex2S + domain warp)
- **postprocessing** (loaded, not yet used)
- **dat.gui** (loaded, not yet used)

## Source Structure
```
src/
├── index.ts / main.ts
└── engine/
    ├── Game.ts                         # Orchestrator only — scene, renderer, loop, system wiring
    │
    ├── config/                         # One file per domain — add new ones as phases grow
    │   ├── TerrainConfig.ts            # GridParameters, TerrainParameters, CoordinateMarkerParameters,
    │   │                               #   EdgeColorLayer interface, EdgeParameters
    │   ├── LightingConfig.ts           # LightingParameters, ReflectionParameters
    │   └── CameraConfig.ts             # CameraParameters
    │
    ├── terrain/
    │   ├── TerrainGenerator.ts         # Heightmap generation loop, buffer management, update tick
    │   ├── TerrainMaterial.ts          # Reflection + panel shader (onBeforeCompile factory)
    │   ├── EdgeMaterial.ts             # 5-layer colour ramp + electric pulse shader (factory + EdgeUniforms)
    │   ├── HeightMap.ts                # Retained height data; all spatial queries for gameplay systems
    │   ├── GridSystem.ts               # World grid parameters + observer pattern
    │   └── LightingSystem.ts           # Sun, sky, halo, day/night cycle (singleton)
    │
    ├── ui/
    │   ├── TerrainControls.ts          # Terrain shape sliders + Regenerate (top-left)
    │   ├── EdgeControls.ts             # Grid colour layers + pulse sliders (beside terrain panel)
    │   └── ReflectionControls.ts       # Terrain/sun reflection params (top-right)
    │
    ├── debug/
    │   └── PerformanceMonitor.ts       # FPS, frame time, draw calls, memory overlay (singleton)
    │
    ├── utils/
    │   ├── BufferPool.ts               # Singleton memory pool for geometry buffers
    │   ├── NoiseSampler.ts             # FastNoiseLite wrapper: baseFBm + peakRidged + domain warp
    │   └── fastnoise-lite.d.ts
    │
    ├── units/                          # Phase 3 — empty, ready
    ├── movement/                       # Phase 3 — empty, ready
    ├── combat/                         # Phase 4 — empty, ready
    ├── resources/                      # Phase 5 — empty, ready
    ├── buildings/                      # Phase 6 — empty, ready
    └── ai/                             # Phase 7 — empty, ready

public/
├── noise-visualizer.html               # Standalone noise debug tool — /noise-visualizer.html
└── FastNoiseLite.js                    # fastnoise-lite copy for visualizer
```

### World Dimensions
- Grid: 100 divisions × 64 units/cell = **8,000 × 8,000** world units
- Render mesh: 200 segments × 40 world units/vertex = 8,000 (higher density than nav grid)
- Terrain height: 0–1400 units default (`HEIGHT_SCALE` in `TerrainConfig`)
- Camera starts at (4000, 3000, 4000), looking at origin
- Orbit range: 100–16,000 units

## What's Working
- ✅ Procedural terrain — FastNoiseLite OpenSimplex2S (no lattice star artifact)
- ✅ Domain warping breaks simplex symmetry — varied topology per seed
- ✅ Ridged multifractal peak layer — sharp connected mountain chains
- ✅ Dynamic lighting system (sun orbit, sky gradient, halo, sunrise/sunset)
- ✅ Terrain reflection shader (panel effect, metalness/roughness by sun angle/height/view)
- ✅ Edge grid shader — 5-layer GPU height-ramp + animated electric pulse (AdditiveBlending neon glow)
- ✅ EdgeControls panel — live colour pickers, height % and intensity per layer, pulse speed/intensity/width
- ✅ OrbitControls camera (pan, zoom, rotate with damping)
- ✅ TerrainControls — height, persistence, base/peak blend, frequencies, warp, peak threshold, octaves, valley
- ✅ Valley carving — Gaussian mask along X axis
- ✅ Noise visualiser at `/noise-visualizer.html` — 6-panel live debug tool
- ✅ Performance monitor overlay
- ✅ Buffer pooling
- ✅ HeightMap — bilinear height query, surface normals, slope angle, traversability, ground orientation (slope-tilt + heading), flying altitude

## What's NOT Implemented (yet)
- ❌ Units, combat, projectiles
- ❌ Resource system (Skirulum, Vlux, Fredalite, Scrap)
- ❌ Buildings / production / AI / minimap
- ⚠️ postprocessing: imported, not wired

## Active Tuning Notes (review at session start)

### Edge Grid — known things to revisit
**Colour layer tuning (EdgeControls panel, live — no regen):**
- Layer 1 intensity 0.00 + black = invisible low ground (good for dark dramatic look)
- Layer 3 (orange ~0.38) + intensity 0.9 = mid-height glow
- Layer 5 (cyan ~0.82) + intensity 3.0+ = electric neon peaks
- All intensity values above 1.0 are HDR — with AdditiveBlending they genuinely over-expose and glow
- Try: layers 1–2 at 0 intensity (dark), layer 3 at 0.5, layer 4 at 1.5, layer 5 at 5–8 for dramatic peak-only glow

**Pulse tuning:**
- `pulseSpeed` 0.0 = frozen static glow, 0.5+ = rapid electricity
- `pulseWidth` 0.02–0.04 = tight sharp zips; 0.15+ = slow rolling wave
- `pulseIntensity` controls brightness of pulse head — 5–12 range for neon effect
- Three simultaneous pulses run at different speeds (×0.61, ×0.37 multiples) with per-edge hash offsets — they don't synchronise
- Pulse colour: warm orange-white at low heights, cool cyan at peaks — adjust in `computePulse()` in `EdgeMaterial.ts`

### Terrain noise — known things to revisit
- `baseFrequency` 0.0004 = large rolling hills. Lower = bigger features, higher = more hills per map.
- `peakFrequency` 0.0008 = ridge scale. Can go higher for more fractured ridgelines.
- `warpAmplitude` 350 = strong twist. Set to 0 to see unwarped noise for comparison.
- `peakThreshold` 0.40 = ~60% of map is mountains. Raise to 0.6 for sparse isolated peaks.
- `persistence` affects both layers via SetFractalGain — lower (0.3) = smooth rounded, higher (0.7) = rough/jagged.

## Remaining Terrain Tasks (Phase 2)

### Known bug
- When terrain is regenerated, `edgeUniforms` is rebuilt from `EdgeParameters` defaults, so any live EdgeControls changes are lost.
- **Fix:** in `TerrainGenerator.regenerate()`, copy live uniform values back into `EdgeParameters` before calling `generate()`, or pass the previous uniforms into `createEdgeMaterial()` as optional overrides.

### Organic valley / river erosion
Currently valley carving uses a **Gaussian mask on the X axis** — straight corridor, looks artificial.

**Option C — Domain-warped valley mask** ← try first (2–3 lines in `generate()`)
Apply the existing domain warp to the valley mask's X coordinate before evaluating:
- Very low effort, reuses existing warp data, creates a winding valley.

**Option A — Meandering path** ← if C feels too symmetrical
Random walk centreline from one edge to the other, Gaussian cross-section carved along it.
Complexity: medium. No shader changes.

**Option B — Hydraulic erosion** ← long-term gold standard
CPU particle simulation post-process on the height buffer before mesh generation.
Reference: Sebastian Lague "Procedural Landmass Generation" (hydraulic erosion episode).

### Terrain presets
Lock in 2–3 good named configs (e.g. `PRESET_DRAMATIC`, `PRESET_ROLLING`, `PRESET_ARCHIPELAGO`) in `TerrainConfig.ts` so sessions don't start from scratch tuning.

## Remaining Refactoring Tasks

### Small / safe
- ✅ ~~Delete `ShaderManager.ts` + unused `skybox`/`sunHalo` shaders~~ — done 10 Aug 2026
- **Split `ReflectionControls.ts` import** — currently imports both `ReflectionParameters` and `LightingParameters` on two lines; could be one `import { ..., ... } from '../config/LightingConfig'` (cosmetic). Still open post-config-split — verify on next touch of that file.

### Before Phase 3 (must-do)
- **InstancedMesh unit renderer architecture** — design `UnitRenderer.ts` in `units/` before writing any unit code. Retrofitting instancing after units exist is painful. Decide: one `InstancedMesh` per unit type, synced each frame from `UnitManager`.
- **NavigationGrid** — build `movement/NavigationGrid.ts` fed by `HeightMap.getSlopeAngle()`. Current CELL_SIZE=64 world units is reasonable; render mesh vertex spacing is 40 — nav grid is coarser than render mesh, which is correct. Decide cell resolution before writing pathfinding.

## Do Not Touch
- `TerrainMaterial.ts` / `EdgeMaterial.ts` — fragile shader injection via `onBeforeCompile`; reflection and edge systems depend on precise uniform setup and injection order
- `LightingSystem.ts` — carefully tuned; colour transitions are parameter-driven
- `BufferPool.ts` — used by TerrainGenerator; changes risk memory leaks
- `index.ts` — must remain a pure re-export with NO side effects (instantiating Game here caused the dual-instance bug)

## Singleton Rules
- `LightingSystem` and `PerformanceMonitor` are singletons — always use `getInstance()`, never `new` directly
- Both clear static instance in `dispose()` so HMR creates a fresh instance correctly
- `Game.dispose()` stops animate() loop (`disposed` flag), removes resize listener, disposes all singletons in order

## HeightMap API (src/engine/terrain/HeightMap.ts)
All gameplay systems get terrain data via `terrainGenerator.getHeightMap()`. Available after first `generate()`, replaced on each `regenerate()`.

| Method | Returns | Use for |
|---|---|---|
| `getHeightAt(x, z)` | `number` | Snap unit Y to surface |
| `getNormalAt(x, z)` | `Vector3` | Surface direction at a point |
| `getSlopeAngle(x, z)` | `number` (radians) | Traversability gate (0=flat, PI/2=cliff) |
| `isTraversable(x, z, maxSlope)` | `boolean` | Pathfinding walkability |
| `getGroundedPosition(x, z)` | `Vector3` | Exact world pos on terrain surface |
| `getGroundOrientation(x, z, facingAngle)` | `Quaternion` | Unit tilt + heading combined |
| `getFlyingY(x, z, targetAlt, minClearance)` | `number` | Flying unit Y above terrain |

`getGroundOrientation` combines a slope-tilt quaternion (`up → surfaceNormal`) with a heading yaw. Units on slopes visually angle with the ground; flying units use `getFlyingY` to stay clear of peaks.

## Development Commands
```bash
npm install       # First time setup
npm start         # Webpack dev server — game at http://localhost:9000
                  # Noise visualiser at http://localhost:9000/noise-visualizer.html
npm run build     # Production bundle → public/bundle.js
```

## Phase Plan

### Phase 1 — Stabilise ✅ DONE

### Phase 2 — Terrain Improvement ⚠️ IN PROGRESS
**Done:**
- ✅ TerrainControls UI with full noise parameter exposure
- ✅ EdgeControls UI with 5-layer colour ramp + animated electric pulse
- ✅ Replaced SimplexNoise with FastNoiseLite (OpenSimplex2S + domain warp)
- ✅ Map doubled to 8000×8000
- ✅ Noise visualiser tool
- ✅ HeightMap — retained spatial query API for all gameplay systems
- ✅ Source refactor — TerrainGenerator halved (766→348 lines); TerrainMaterial + EdgeMaterial extracted; GameParameters split into TerrainConfig / LightingConfig / CameraConfig; stub folders for all future phases

**Remaining:**
- ⬜ Fix edgeUniforms lost on regen bug (see above)
- ⬜ Organic valley/river carving — try Option C first
- ⬜ Lock in named terrain presets

### Phase 3 — Add Units
Pre-requisite architecture in place:
- ✅ HeightMap spatial queries (height, slope, orientation, fly altitude)
- ✅ Folder structure (`units/`, `movement/`)
- ⬜ Design InstancedMesh renderer before writing Unit code
- ⬜ NavigationGrid from HeightMap slope data
- Unit class, UnitManager, click-to-select, right-click-to-move, health bar

### Phase 4 — Combat
### Phase 5 — Resource System (Skirulum, Vlux, Fredalite, Scrap)
### Phase 6 — Buildings & Production
### Phase 7 — AI & Polish

## Session Log
| Date | What Was Done |
|------|---------------|
| Early 2025 | Core engine, units, combat, projectile/LoS fixes (old-main) |
| Mar 2025 | Bloom, edge detection, visual polish (feature/tron-aesthetic) |
| Mar–Apr 2025 | Terrain rebuild, lighting, buffer pooling, performance monitor |
| 28 Mar 2026 | Promoted to main; TerrainControls UI, valley carving, tuned defaults |
| 29 Mar 2026 | Architecture audit; LightingSystem/PerformanceMonitor dispose fix; Game disposed flag; resize listener fix |
| 29 Mar 2026 | Fixed dual Game instance bug (index.ts side effect). Fixed vertex colour normalisation. HMR cleanup in main.ts. |
| 29 Mar 2026 | Replaced SimplexNoise with FastNoiseLite (OpenSimplex2S + ridged peaks + domain warp). Full noise param exposure in TerrainControls. Noise visualiser at /noise-visualizer.html. |
| 29 Mar 2026 | Doubled map to 8000×8000. Edge grid replaced with GPU shader: 5-layer height colour ramp + animated electric pulse (3 overlapping pulses, per-edge hash offset, AdditiveBlending neon glow). EdgeControls live debug panel. |
| 01 Apr 2026 | Added HeightMap (terrain/HeightMap.ts): retained height data, bilinear queries, surface normals, slope, traversability, ground orientation (slope-tilt + heading), flying altitude. TerrainGenerator.getHeightMap() exposes to all gameplay systems. |
| 01 Apr 2026 | Source refactor: TerrainGenerator 766→348 lines; TerrainMaterial.ts + EdgeMaterial.ts extracted (shader logic unchanged); GameParameters.ts split into TerrainConfig/LightingConfig/CameraConfig; dead coordinate-marker code removed; stub folders created for units/movement/combat/resources/buildings/ai. |
| 10 Aug 2026 | Resumed after break. Verified branch history (reflog + merge-base) — confirmed the 01 Apr refactor was uncommitted-but-legitimate work on top of `main`, not a stray branch. Committed it (build + `tsc --noEmit` both clean). Deleted legacy `ShaderManager.ts` + unused `skybox`/`sunHalo` shader files (confirmed zero references first). Untracked `public/bundle.js` (was tracked before it got gitignored). Pruned 6 stale branches, local + remote (`old-main`, `backup/debug-ui-wip`, `feature/tron-aesthetic`, `main-28-03-26`, `state-machine-implementation`, `terrain-rebuild`) — all fully merged into `main`, verified with `git merge-base --is-ancestor`. Repo now has a single branch: `main`. |

---
*Update this file at the end of every coding session.*
*Claude Code reads this automatically at session start.*
