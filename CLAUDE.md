# Project: LowDrag RTS

## What This Is
A voxel-based real-time strategy game inspired by Total Annihilation. Built with TypeScript, Three.js, and Webpack. Rendered in the browser. Hobby project — worked on in sessions when time allows.

## Current Status
✅ **Compiles cleanly. Builds successfully. No TypeScript errors.**

This branch (`main`) is a **terrain/rendering/engine branch**. It does NOT contain units, combat, projectiles, or a resource system. The focus is the visual engine — terrain, lighting, reflections, edge grid effects and performance.

The `old-main` branch on GitHub contains the combat and unit code if needed for reference.

## Tech Stack
- **TypeScript** (strict mode, ES6 target)
- **Three.js** (3D rendering)
- **Webpack 5** (bundler + dev server)
- **fastnoise-lite** (procedural terrain — OpenSimplex2S + domain warp, replaces old simplex-noise)
- **postprocessing** (loaded, not yet used)
- **dat.gui** (loaded, not yet used)

## Architecture

### Entry Points
- `src/main.ts` → single `new Game()` instance, HMR dispose hook
- `src/index.ts` → re-exports `Game` only (NO side effects — critical, see Singleton Rules)
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
│   │   ├── TerrainGenerator.ts     # Procedural terrain mesh, shader injection, valley carving, edge shader
│   │   ├── GridSystem.ts           # 8000-unit grid with observer pattern
│   │   └── LightingSystem.ts       # Sun, sky, halo, day/night cycle
│   ├── ui/
│   │   ├── TerrainControls.ts      # Terrain shape sliders + Regenerate (top-left)
│   │   ├── EdgeControls.ts         # Grid colour layer + pulse animation sliders (beside terrain panel)
│   │   └── ReflectionControls.ts   # Terrain/sun reflection params (top-right)
│   ├── debug/
│   │   └── PerformanceMonitor.ts   # FPS, frame time, draw calls, memory overlay
│   └── utils/
│       ├── BufferPool.ts           # Singleton memory pool for geometry buffers
│       ├── NoiseSampler.ts         # FastNoiseLite wrapper: baseFBm + peakRidged + domain warp
│       └── fastnoise-lite.d.ts     # TypeScript declarations for fastnoise-lite
└── types/
    ├── postprocessing.d.ts
    └── simplex-noise-esm.d.ts
public/
├── noise-visualizer.html           # Standalone noise debug tool — open at /noise-visualizer.html
│                                   # Mirrors NoiseSampler.ts exactly, all sliders live-update 6 panels
└── FastNoiseLite.js                # Copy of node_modules/fastnoise-lite for visualizer (module import)
```

### World Dimensions
- Grid: 100 divisions × 64 units/cell = **8,000 × 8,000** world units (doubled this session)
- Terrain height: 0–1400 units default (HEIGHT_SCALE in TerrainConfig)
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

## What's NOT Implemented (yet)
- ❌ Units, combat, projectiles
- ❌ Resource system (Skirulum, Vlux, Fredalite, Scrap)
- ❌ Buildings / production / AI / minimap
- ⚠️ postprocessing: imported, not wired
- ⚠️ ShaderManager.ts: legacy, superseded by onBeforeCompile injection

## Active Tuning Notes (review at session start)

### Edge Grid — known things to revisit
The electric pulse + 5-layer colour system is new and needs aesthetic tuning:

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
- Pulse colour: warm orange-white at low heights, cool cyan at peaks (hardcoded in shader, adjust in `computePulse()` in `createEdgeMaterial()`)

**Known issue to fix next session:**
- When terrain is regenerated, `edgeUniforms` is rebuilt from `EdgeParameters` defaults, so any live UI changes are lost. Consider copying live values back to `EdgeParameters` before regen, or preserving uniforms across regen.

### Terrain noise — known things to revisit
- `baseFrequency` 0.0004 = large rolling hills. Lower = bigger features, higher = more hills per map.
- `peakFrequency` 0.0008 = ridge scale. Can go higher for more fractured ridgelines.
- `warpAmplitude` 350 = strong twist. Set to 0 to see unwarped noise for comparison.
- `peakThreshold` 0.40 = ~60% of map is mountains. Raise to 0.6 for sparse isolated peaks.
- `persistence` affects both layers via SetFractalGain — lower (0.3) = smooth rounded, higher (0.7) = rough/jagged.

## Future Task: Organic Valley / River Erosion
**Do not implement yet — design notes for next session.**

Currently valley carving uses a **Gaussian mask on the X axis** — it creates a straight corridor through the map centre. This looks artificial.

### Goal
Replace or augment with valleys that look like **genuine river erosion** — winding channels, tributary branches, widening toward lowland, narrowing at headwaters.

### Approaches to consider

**Option A — Meandering path (recommended starting point)**
Generate a river centreline using a random walk or spline with controlled curvature:
1. Start at one map edge, end at the other (or coast)
2. At each step, add a small random lateral displacement biased toward lower terrain
3. Carve a Gaussian cross-section (width/depth varying along path — narrow at source, wide at mouth)
4. Can add tributaries by branching the walk at random points
- Complexity: medium. Fully in CPU terrain generation, no shader changes.

**Option B — Hydraulic erosion simulation**
Run a simplified water particle simulation over the generated heightmap:
1. Drop thousands of particles at random high points
2. Each particle moves downhill, carries sediment, deposits on flat areas
3. After N iterations the terrain has natural channels, alluvial fans, delta plains
- Complexity: high, but produces the most realistic result
- Reference: Sebastian Lague "Procedural Landmass Generation" series (hydraulic erosion episode)
- Can be CPU-side as a post-process on the height buffer before mesh generation

**Option C — Domain-warped valley mask**
Apply the existing domain warp to the valley Gaussian mask coordinates before evaluating:
- The mask currently uses raw X position; warp it with the same warpX/warpZ samplers used for terrain
- Very low effort change (2–3 lines in `generate()`)
- Creates a winding valley that follows the existing terrain warp — organic feel with minimal code
- Good first step before investing in Option A or B

**Option D — Flow field (vector-based)**
Use a low-frequency noise gradient as a flow field, trace streamlines from high to low, carve along them.
- More control than random walk, less compute than hydraulic erosion

### Recommended order
1. Try **Option C** first (minimal risk, reuses existing warp data)
2. If result feels too symmetrical, move to **Option A** (meander walk)
3. **Option B** (hydraulic) is the long-term gold standard but a significant time investment

## Do Not Touch
- `TerrainGenerator.ts` — fragile shader injection via `onBeforeCompile`; reflection and edge systems depend on precise uniform setup
- `LightingSystem.ts` — carefully tuned; colour transitions are parameter-driven
- `BufferPool.ts` — used by TerrainGenerator; changes risk memory leaks
- `index.ts` — must remain a pure re-export with NO side effects (instantiating Game here caused the dual-instance bug)

## Singleton Rules
- `LightingSystem` and `PerformanceMonitor` are singletons — always use `getInstance()`, never `new` directly
- Both clear static instance in `dispose()` so HMR creates a fresh instance correctly
- `Game.dispose()` stops animate() loop (`disposed` flag), removes resize listener, disposes all singletons in order

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

**Remaining:**
- ⬜ Aesthetic tuning of edge colours and pulse (see tuning notes above)
- ⬜ Organic valley/river carving (see future task notes above)
- ⬜ Lock in good terrain presets as named configs

### Phase 3 — Add Units
- Basic `Unit` class, `UnitManager`, click-to-select, right-click-to-move, health bar

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

---
*Update this file at the end of every coding session.*
*Claude Code reads this automatically at session start.*
