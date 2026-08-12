# Project: LowDrag RTS

## What This Is
A heightmap-based real-time strategy game inspired by Total Annihilation. TypeScript, Three.js, Webpack. Runs in the browser. Hobby project, worked on in sessions when time allows.

## Current Status
✅ Compiles cleanly, builds successfully, no TypeScript errors.

Phase 2 (terrain) is essentially done — procedural terrain, unified visual/build grid, plateaus, region-masked flatland/mountain zoning, full synthwave visual pass (bloom, lighting, reflections). No units, combat, projectiles, or resources yet.

A full game-simulation architecture plan exists for Phases 3+ (units, movement, combat, multiplayer, economy, AI) — locked decisions: multiplayer is a hard goal (fixed-tick sim, deterministic RNG, command-based input from day 1), design for 300+ units (SoA data, InstancedMesh rendering). See `## Phase Plan` below for the condensed version — an external Claude Code plan file has the full detail but isn't checked into git; re-derive/re-save into this doc if it's ever gone.

Old combat/unit code lives in history at commit `3b6eeea`. Verdict from audit: rewrite-guide, not port — its `Unit extends THREE.Object3D` design fuses sim and render and blocks instancing at scale.

## Known Issues
- 🟡 **Minor sun-glint bleed remains at a few panel edges.** The major forward/back-glint problem is resolved: live testing confirmed the world-space normal fix makes the glint land mostly on correctly sun-facing panels, and the back glint now works reasonably well. The remaining small bleed is visual polish, not a Phase 3 blocker; leave the tuned effect alone until later unless it becomes materially distracting.

## Tech Stack
- **TypeScript** (strict mode, ES6 target, `moduleResolution: node` — NOT `bundler`, see gotcha below)
- **Three.js** (3D rendering)
- **Webpack 5** (bundler + dev server)
- **fastnoise-lite** (procedural terrain — OpenSimplex2S + domain warp, also drives the region-mask noise channel)
- **postprocessing** (pmndrs) — bloom + ACES tone mapping + brightness/contrast + vignette, wired in `Game.ts`
- **dat.gui** — still an unused dependency (Phase 3 cleanup chore, not done)

### Gotcha: don't switch `moduleResolution` to `"bundler"`
Broke `three/examples/jsm/...` subpath imports (OrbitControls) without fixing the actual issue. The real fix for the `postprocessing` type-resolution problem was deleting a stale hand-written `src/types/postprocessing.d.ts` stub shadowing the real package's bundled types. Keep `"node"`.

### Gotcha: `npm start`'s dev server can silently serve a stale bundle
This repo lives in a cloud-synced folder. Webpack's default file watcher relies on native OS fs-change events, which cloud sync layers can drop or delay — the dev server then keeps serving the pre-edit bundle with no error and no live-reload. Symptom: a code change "does nothing" even after a manual refresh. Fixed via `watchOptions: { poll: 1000 }` in `webpack.config.js`. If an edit ever seems to have zero effect, restart `npm start` fresh before assuming the change itself is wrong.

## Source Structure
```
src/
├── index.ts / main.ts              # index.ts MUST stay a pure re-export, no side effects
├── sim/                             # First sim-layer code, Three-free by rule (see Phase Plan)
│   └── core/
│       └── Rng.ts                  # sfc32 deterministic PRNG — only sanctioned randomness
│                                    #   source for sim code; Math.random banned there. Used by
│                                    #   TerrainGenerator for plateau/region-mask site selection.
└── engine/
    ├── Game.ts                     # Orchestrator — scene, renderer, EffectComposer, loop, wiring
    │
    ├── config/
    │   ├── TerrainConfig.ts        # GridParameters, TerrainParameters, BuildingFootprints,
    │   │                           #   EdgeColorLayer interface, EdgeParameters
    │   ├── LightingConfig.ts       # LightingParameters, ReflectionParameters
    │   ├── ReflectionState.ts      # One live reflection/glitter state shared by UI + materials
    │   └── CameraConfig.ts         # CameraParameters (wired into Game.ts)
    │
    ├── terrain/
    │   ├── TerrainGenerator.ts     # Heightmap generation loop, plateau + region-mask logic,
    │   │                           #   buffer management, update tick, presets
    │   ├── TerrainGrid.ts          # THE terrain grid — one geometry, feeds EdgeMaterial for the
    │   │                           #   visual AND the buildability data (isFootprintBuildable)
    │   ├── TerrainMaterial.ts      # Reflection + panel shader (onBeforeCompile factory) + "sea"
    │   │                           #   shimmer (normal perturbation, not real waves — see below)
    │   ├── EdgeMaterial.ts         # 5-layer colour ramp + electric pulse shader
    │   ├── HeightMap.ts            # Retained height data; spatial queries incl. isInBounds/isBuildable
    │   ├── GridSystem.ts           # World grid parameters + world↔cell conversion + observer pattern
    │   └── LightingSystem.ts       # Sun (flat billboarded circle + scanlines), sky, halo, day/night (singleton)
    │
    ├── ui/
    │   ├── TerrainControls.ts      # Shape/Regions/Valley/Plateau sliders + Presets + Regenerate
    │   ├── EdgeControls.ts         # Grid colour layers + pulse sliders
    │   ├── ReflectionControls.ts   # Terrain/sun reflection params (Position Factor min is 0.1, not
    │   │                           #   0 — see Do Not Touch)
    │   ├── SettingsIO.ts           # Save/load the whole tunable scene as one JSON blob — bundles
    │   │                           #   each panel's own exportSettings()/importSettings(). Also
    │   │                           #   owns "Reset Panel Positions".
    │   └── Draggable.ts            # makeDraggable(container, titleEl, key) — all 5 panels drag by
    │                               #   title bar, position persists in localStorage. Panels with a
    │                               #   renderAll()-style full-DOM-rebuild MUST destroy()/rebind the
    │                               #   handle on every rebuild.
    │
    ├── debug/
    │   └── PerformanceMonitor.ts   # FPS, frame time, draw calls, resource counts + JS heap (singleton).
    │                               #   Uses stored element refs (this.statsContainer etc.), NOT
    │                               #   this.container.firstChild/children[N] — keep it that way.
    │
    ├── utils/
    │   ├── BufferPool.ts           # Singleton memory pool for geometry buffers
    │   ├── NoiseSampler.ts         # FastNoiseLite wrapper: baseFBm + peakRidged + domain warp + regionMask
    │   └── fastnoise-lite.d.ts
    │
    ├── units/ movement/ combat/ resources/ buildings/ ai/   # DELETED — empty, wrong tree.
    │                                                          # Gameplay is sim-side (src/sim/).
```
(`src/types/postprocessing.d.ts` — deleted; was a stale stub shadowing the real package's types.)

```
public/
├── noise-visualizer.html               # Standalone noise debug tool — /noise-visualizer.html
└── FastNoiseLite.js                    # fastnoise-lite copy for visualizer
```

```
tools/
└── simulate-sun-glitter.js             # Standalone Node sim of calculateSunGlitter() AND
                                         #   calculateBackGlint() — ASCII-previews both shapes via
                                         #   a real camera raycast, no browser needed.
                                         #   `node tools/simulate-sun-glitter.js`. Has caught real
                                         #   shape bugs hand-reasoning about the GLSL missed — rerun
                                         #   before re-tuning either glint term by eye/guesswork.
```

### World Dimensions
- Total size: **8,000 × 8,000** world units, `GridParameters.BUILD_CELL_SIZE = 64`
- `BUILD_CELL_COUNT` is derived as 8,000 / 64 = **125**; there is no separate editable divisions value.
- Height sampling is named separately (`HEIGHT_SAMPLE_SPACING` / `HEIGHT_SAMPLE_COUNT`) so deformation can become denser later. It currently matches the build grid: 126 samples per axis, 125 segments, 1 mesh quad = 1 build cell.
- Terrain height: 0–1400 units default (`HEIGHT_SCALE`)
- Camera starts at (4000, 3000, 4000), looking at origin, far clip 500000 (sky/halo geometry needs the headroom)
- Orbit range: 100–16,000 units
- Building footprints: `BuildingFootprints.SMALL/MEDIUM/LARGE` = 1/2/3 grid cells (convention only — no real buildings yet)

## What's Working
- ✅ Procedural terrain — FastNoiseLite OpenSimplex2S, domain-warped, ridged peaks
- ✅ Region-masked flatland/mountain zoning — coherent flat regions with mountains rising out of them, not uniform ruggedness. On by default (`regionMaskEnabled`), off in the Rolling preset.
- ✅ Plateau build-sites — deterministic (seeded `Rng`) flat circular sites, `TerrainControls` sliders, `getPlateauSites()`
- ✅ Unified terrain grid (`TerrainGrid.ts`) — one geometry drives both the neon visual and buildability
- ✅ Dynamic lighting — flat billboarded sun disc (not a sphere, avoids perspective-curved scanlines), sky gradient, halo, retro scanlines, day/night
- ✅ Terrain reflection shader — tinted by the sun's live colour
- ✅ Edge grid shader — 5-layer GPU height-ramp (synthwave: navy→purple→pink→orange) + animated electric pulse
- ✅ Bloom/tone-mapping/grading pipeline (`postprocessing`) — HDR buffer, ACES tone mapping, brightness/contrast + vignette
- ✅ HeightMap — bilinear height query, normals, slope, traversability, ground orientation, flying altitude, `isInBounds`, `isBuildable`
- ✅ Terrain presets — `PRESET_DRAMATIC` / `PRESET_ROLLING` / `PRESET_BATTLEFIELD`
- ✅ OrbitControls camera, TerrainControls, EdgeControls, ReflectionControls
- ✅ Save/load settings (`SettingsIO.ts`) — full scene as JSON, including seed
- ✅ Draggable panels (`Draggable.ts`) — position persists in `localStorage`; "Reset Panel Positions" button
- ✅ "Sea" shimmer (`TerrainMaterial.ts`) — low/flat ground gets a cheap time-varying normal perturbation for reflection only, so glints dance like light on water without real geometry motion. Gate is `height / heightScale`, matching the vertex-colour gradient's own normalisation.
- ✅ Sun glitter path — explicitly authored wedge envelope along the real camera→sun ground axis (`calculateSunGlitter()`, `TerrainMaterial.ts`), textured with grid-aligned shard sparkle, shape-verified via `tools/simulate-sun-glitter.js` rather than eyeballed. See Active Tuning Notes below for the constants/gotchas.
- ✅ Valley corridor rotation (`TerrainGenerator.ts`) — `TerrainConfig.valleyAngle` (0–360°, slider in `TerrainControls`), rotates the Gaussian valley-carving corridor. Defaults to 90° in all presets (runs east-west, aligned with the sun's fixed westward orbit).
- ✅ Noise visualiser at `/noise-visualizer.html`, performance monitor, buffer pooling

PerformanceMonitor's `Geometries` and `Textures` values are Three.js resource counts, not GPU-memory byte estimates. JS heap values are shown only when the browser exposes them.

## What's NOT Implemented (yet)
- ❌ Units, combat, projectiles
- ❌ Resource system (Skirulum, Vlux, Fredalite, Scrap)
- ❌ Buildings / production / AI / minimap
- ❌ Any sim layer beyond `sim/core/Rng.ts` — no ticks, no commands, no determinism harness yet (Phase 3)

## Active Tuning Notes (review at session start)

### Sun (LightingSystem.ts)
- Sun is a flat billboarded `CircleGeometry`, not a sphere — a 3D sphere's surface bulges toward camera under perspective, so patterns on it (scanlines) curve slightly even from "flat" quantities. Revert to a sphere only with that tradeoff in mind.
- Scanlines: upper half only, fades in via `smoothstep` from the equator; tight/thick near equator, sparse/thin near pole.
- Minimum sun position is a hardcoded `minAngle` constant in `updateSunPosition()`, not derived from `SUN_MIN_HEIGHT`/`SUN_MAX_HEIGHT` config — those only normalise the height slider. Was previously below the horizon; fixed.
- `SUN_TERRAIN_LIGHT_SCALE` decouples the sun's visual brightness (disc/halo) from how much light it casts on terrain. The "Sun Intensity" target is smoothed and now drives both the disc/halo and terrain light; elevation remains a separate multiplier on the terrain light only.

### Reflection shader (TerrainMaterial.ts)
- **Reflection settings have one live owner:** `TerrainReflectionState` is shared by `ReflectionControls`, the current shader uniforms and every newly generated material. Vector uniforms are mutated in place; uniform-only edits must not set `material.needsUpdate`. Terrain regeneration therefore preserves metalness, roughness, position/power and glitter reach/width instead of restoring config defaults. Sun intensity export reads `LightingSystem.getTargetSunIntensity()`, not the default constant.
- **Coordinate-space invariant:** `vWorldPosition`, `vWorldNormal`, `sunWorldPosition` and Three's built-in `cameraPosition` are all world-space. `normalMatrix` alone returns a view-space normal; the vertex injection must convert it with `inverseTransformDirection(..., viewMatrix)` before storing `vWorldNormal`. Mixing those spaces made the custom glint rotate incorrectly with the camera while the world-space standalone simulator still passed.
- **"Debug: Glitter Only" checkbox** (`ReflectionControls`) — renders `calculateSunGlitter() + calculateBackGlint()`'s raw output in isolation (flat greyscale, roughness/metalness forced non-reflective). Writes to `gl_FragColor` at `#include <dithering_fragment>` (the last chunk in Three's fragment shader) — NOT `diffuseColor`, which is only a lighting input and still gets multiplied by scene light before reaching the screen. Use this first whenever it's unclear if a complaint is about the sun-tracking term or a confound. The neon grid (`EdgeMaterial`) is a separate mesh and isn't hidden by this toggle.
- **Three.js's own built-in PBR specular is a separate system from this file's custom shader.** `calculateReflection()` only feeds `diffuseColor`/`roughnessFactor`/`metalnessFactor` into Three's standard lighting — the actual specular highlight is computed by Three's own code against the real `DirectionalLight`, independent of anything in `onBeforeCompile`. If reflections look "shiny everywhere, ignoring my shader logic," check `REFLECTION_PARAMS.x`/`.y` (Metalness/Roughness baseline) before assuming the custom code is broken. `roughnessFactor`/`metalnessFactor` are fixed sliders now (`reflectionParams.y`/`.x` directly) — NOT modulated by `reflectionStrength` any more, since doing so re-triggered Three's built-in highlight right on top of the shard pattern (smooth, not discretized — visually overwhelmed it).
- `calculateReflection()`'s `totalFactor` sums several weighted terms: `sunGlitter` and `backGlint` (both sun-tracking, `SUN_GLITTER_WEIGHT`), `positionFactor` (camera→sun-axis-centred ambient glow, `POSITION_FACTOR_WEIGHT`), `panelFactor` (grid-cell texture noise, `PANEL_FACTOR_WEIGHT`), `grazingFactor*heightFactor` (camera-angle vs. slope, `GRAZING_FACTOR_WEIGHT`). The non-glitter terms are deliberately weighted low (~0.02–0.06) so they read as a subtle base sheen and don't outshine the sun-tracking terms — they did exactly that at higher weights historically, which is worth remembering if reflections ever seem to stop tracking the sun again despite `calculateSunGlitter()` itself being correct.
- `reflectionStrength` (the return of `calculateReflection()`) is `clamp()`-ed to `[0,1]` — it used to be unclamped and routinely exceeded 1.0, which fed unclamped `mix()` blend factors downstream and caused extrapolation artifacts (negative roughness, blown-out colour). If reflections look broken again, check this clamp survived.
- **`facingSun`/`dot(normal, sunDir)` must be a soft GATE, not a continuous brightness multiplier**, for any specular/mirror-style effect — Lambertian dimming is correct for diffuse light, wrong for specular (which gets STRONGER at grazing/low angles, not weaker). Using it as a multiplier previously crushed the whole glitter effect at low sun angles.
- Glitter is emissive (`GLINT_EMISSIVE_INTENSITY`, added to Three's `totalEmissiveRadiance`) as well as mixed into `diffuseColor` — needed because `MeshStandardMaterial` is lit, and at low sun/light levels a purely-diffuse glint was invisible regardless of its computed value. Emissive bypasses the lit BRDF pipeline entirely.
- Sparkle texture is grid-aligned shards (`shardSparkle()`, shared by both `calculateSunGlitter()` and `calculateBackGlint()`) — floors world position into `GridParameters.BUILD_CELL_SIZE` cells (same offset `GridSystem.worldToCell()` uses) before hashing, so a whole cell lights up flat and uniform instead of per-pixel noise ("TV static"). Not time-animated — brightness is a pure function of position; it still changes as camera/sun move because the envelope/gate terms are live-position-dependent. `GLITTER_SHARD_SEAM` (dark border) and a per-shard radial glow (`GLITTER_SHARD_GLOW_FLOOR`, brightest at shard centre) are what make it read as "glint" rather than flat colour.
- Wedge envelope (`calculateSunGlitter()`): explicit shape along the real camera→sun ground axis (`sunAxisInfo()` helper, shared with `positionFactor`/`calculateBackGlint()`), NOT emergent from jittered-normal Blinn-Phong — two earlier emergent-physics attempts were verified wrong (backwards shape, or a single misaligned point) by numeric simulation, not just eyeballing. `GLITTER_ALONG_NEAR/WIDTH_NEAR` calibrated against the actual camera frustum. Far-end width auto-scales with sun height (`GLITTER_WIDTH_AUTO_MIN/MAX/CURVE_POWER`, fit to example data points — verify via the simulation's built-in curve check before retuning). `glitterReach` uniform (x=reach, y=width multiplier) is live-adjustable via the "Sun Glitter" UI section. Falloff is one continuous gradient from the centreline (not a flat-then-cliff) for a "central bright core, soft edge" look. `GLINT_LOW_SUN_BOOST_MAX/POWER` compensate for width-curve spreading the same sparkle density thinner at low sun heights.
- The wedge's axis converges exactly on the sun only in the far limit — the near-camera segment is genuinely offset from dead-centre for any camera not looking directly along that axis. That's real geometry for a thin line, not a bug; width (not more precision) is what makes it read as "in the sun's direction." Don't chase pixel-perfect near-camera alignment.
- `calculateBackGlint()` — real half-vector Blinn-Phong specular (`pow(dot(facetNormal, normalize(toSun+toCam)), BACK_GLINT_SHININESS)`) against the real per-fragment normal, covering the region `calculateSunGlitter()`'s `inFront` gate excludes (sun behind camera). Flat ground stays dark (a low sun's half-vector is nearly horizontal, can't satisfy `dot(N,H)` against a flat normal); only genuinely steep, favourably-tilted slopes light up. Small per-shard jitter (via `shardSparkle()`'s grid) gives scatter instead of a single streak. Gated by `facingSunGate`/`facingCamGate` plus a smooth `behindGate` handoff from the forward wedge's region. **Passed all simulation shape checks but did not fix the issue live — see Known Issues at the top of this file.**
- Confirmed-good baseline (bake-in point, not to retune without reason): `REFLECTION_PARAMS` = metalness 1.00, roughness 0.32, positionFactor 2.70, reflectionPower 1.50; `SUN_BASE_INTENSITY` = 2.00. Sun Height/Glitter Reach/Glitter Width stay scene-dependent, not part of this baseline.
- `positionFactor` is camera→sun-axis-centred (via `sunAxisInfo()`), not a fixed west-edge falloff (the old version only coincidentally looked sun-aligned facing west, never re-centred when panning). Width = `max(AMBIENT_GLOW_WIDTH_MIN, reflectionParams.z * AMBIENT_GLOW_WIDTH_SCALE)`; `AMBIENT_GLOW_WIDTH_SCALE=600` is first-pass, not fully live-verified. Also gated by the same `facingSunGate` as `grazingFactor`, so shine doesn't appear on terrain facing away from the sun.
- Uniforms must be BOTH set from JS (`s.uniforms.x`) AND declared in the injected GLSL (`uniform float x;`) — a mismatch here (JS sets it, GLSL never declares it) has silently no effect and has happened more than once in this file. Check both sides if a new uniform seems inert.
- `smoothstep(0, max(0.001, x), ...)` — the `max()` guard matters; `x` reaching exactly 0 is undefined GLSL behaviour and has produced NaN/white-blowout. Don't remove these guards.

### Edge Grid
- Colour ramp: navy→indigo→purple→pink→orange (low→high), no cyan. Pulse: purple at low heights → orange at peaks.
- All live-tunable in EdgeControls — the above are starting defaults only.
- Edge layer height thresholds must stay strictly ascending with at least a 1% gap. Defaults are ordered; sliders clamp against neighbouring layers; imported settings and material creation normalize invalid values before uniforms are written.

### Terrain noise
- `baseFrequency` 0.0004 = large rolling hills. `peakFrequency` 0.0008 = ridge scale. `warpAmplitude` 350 = strong twist. `peakThreshold` 0.40. `persistence` — lower = smooth rounded, higher = rough/jagged.
- `regionMaskFrequency` 0.00004 — much lower than base/peak, for big coherent zones not detail. `regionFlatAmplitude` 0.18, `regionMountainAmplitude` 1.0.
- Valley corridor orientation (`valleyAngle`, 0–360°) rotates the Gaussian valley mask via `alongValley = xPos*cos(angle) + zPos*sin(angle)`, computed once per `generate()` call. Default 90° runs it east-west, aligned with the sun's fixed westward orbit.

## Remaining Terrain Tasks (Phase 2 tail — optional polish, not blocking Phase 3)
- ⬜ Organic valley/river carving — still a straight Gaussian-mask corridor. Try domain-warping the valley mask's X coordinate first.
- ⬜ `ReflectionControls.ts` import — two lines from `LightingConfig`, could be one. Cosmetic.

## Water / Sea — future options (not built beyond the shimmer above)
Three tiers, cheapest to most expensive — only the first is built:
1. **Normal-perturbation shimmer** (✅ done) — reflection-only, time+position driven, gated by height. No geometry changes.
2. **Real vertex ripples** (not built) — small time-based Y displacement for low/flat vertices. Complications: normals are baked CPU-side assuming undisplaced positions (needs analytic in-shader recomputation); `TerrainGrid.ts` is separate static geometry draped on the same height data (would visibly detach unless the identical displacement is replicated in both `TerrainMaterial.ts` and `EdgeMaterial.ts`'s vertex shaders).
3. **Dedicated water plane** (not built) — separate mesh/material, scrolling normal maps, Fresnel, foam. Hard part is the SHAPE: the "sea" region isn't a fixed rectangle, varies per seed — needs a generation-time mask or a height-threshold clip sampling the terrain height texture.

## Do Not Touch (but see below — surgical numeric/defensive fixes are fine)
- `TerrainMaterial.ts` / `EdgeMaterial.ts` — fragile shader injection via `onBeforeCompile`; reflection and edge systems depend on precise uniform setup and injection order. Don't restructure the injection wiring or `#include` target strings without understanding them — narrow constant/expression edits within an already-matched block are normal maintenance.
- `LightingSystem.ts` — carefully tuned; colour transitions are parameter-driven. Same caveat — targeted edits are fine, restructuring isn't.
- `BufferPool.ts` — used by TerrainGenerator; changes risk memory leaks
- `index.ts` — must remain a pure re-export with NO side effects (instantiating Game here caused a dual-instance bug previously)
- **Three.js reserved uniform names** — `cameraPosition`, `viewMatrix`, `modelMatrix`, `projectionMatrix`, `normalMatrix`, etc. are auto-declared by `#include <common>`/Three's own chunks. Declaring a custom uniform with one of these names in an `onBeforeCompile` injection is a GLSL redefinition — compile error. Check whether Three already provides something before adding a custom uniform for it.

## Singleton Rules
- `LightingSystem` and `PerformanceMonitor` are singletons — always use `getInstance()`, never `new` directly
- Both clear static instance in `dispose()` so HMR creates a fresh instance correctly
- `Game.dispose()` is idempotent, stops animate() via its `disposed` flag, removes the resize listener, disposes OrbitControls and guards DOM removal. `TerrainGenerator.dispose()` also clears the singleton BufferPool.
- Terrain regeneration disposes the root surface material plus the child neon-grid geometry/material; the root geometry's pooled typed arrays are released separately by `disposeGeometry()`. Keep that ownership split to avoid grid leaks or returning live surface buffers to the pool.

## HeightMap API (src/engine/terrain/HeightMap.ts)
All gameplay systems get terrain data via `terrainGenerator.getHeightMap()`. Available after first `generate()`, replaced on each `regenerate()` — **no change notification**, don't cache the reference across a regen.

| Method | Returns | Use for |
|---|---|---|
| `getHeightAt(x, z)` | `number` | Snap unit Y to surface |
| `getNormalAt(x, z)` | `Vector3` | Surface direction at a point |
| `getSlopeAngle(x, z)` | `number` (radians) | Traversability gate (0=flat, PI/2=cliff) |
| `isTraversable(x, z, maxSlope)` | `boolean` | Pathfinding walkability |
| `isInBounds(x, z)` | `boolean` | Distinguish "edge of map" from "off the map" (other queries clamp silently) |
| `isBuildable(x, z, footprintRadius, maxSlopeRad?)` | `boolean` | Placement check — stricter default slope tolerance than traversability |
| `getGroundedPosition(x, z)` | `Vector3` | Exact world pos on terrain surface |
| `getGroundOrientation(x, z, facingAngle)` | `Quaternion` | Unit tilt + heading combined |
| `getFlyingY(x, z, targetAlt, minClearance)` | `number` | Flying unit Y above terrain |

`getGroundOrientation` combines a slope-tilt quaternion (`up → surfaceNormal`) with a heading yaw. Units on slopes visually angle with the ground; flying units use `getFlyingY` to stay clear of peaks.

`GridSystem` also has `worldToCell/cellToWorld/cellCenterWorld/getCellCount` — the logical placement grid, same cells `TerrainGrid.ts` draws.

Height queries clamp fractional grid coordinates before interpolation. This matters at the world edge: clamping only the integer cell while leaving `fx`/`fz` outside `[0,1]` extrapolates heights and corrupts the central-difference normals used by buildability/navigation. Call `isInBounds()` first when off-map input should be rejected rather than clamped.

## Development Commands
```bash
npm install       # First time setup
npm start         # Webpack dev server — game at http://localhost:9000
                  # Noise visualiser at http://localhost:9000/noise-visualizer.html
npm run build     # Production bundle → public/bundle.js
npm run typecheck # Typecheck all current source
npm run typecheck:sim # Typecheck the isolated simulation tree only
npm test          # Run Vitest once
npm run test:watch # Run Vitest in watch mode
npm run verify    # Required full gate: both typechecks → tests → production build
```

## Phase Plan
**Locked decisions:** multiplayer is a hard goal (lockstep-grade determinism from day 1: fixed tick, seeded RNG, commands, per-tick checksums — netcode itself deferred to Phase 7); design for 300+ units (SoA typed arrays, InstancedMesh); Milestone 1 = combat sandbox (two teams fighting, not menus/economy first).

**Architecture rules for all of it:** `src/sim/` imports nothing from `engine/`/`game/`, no Three.js, no DOM — sim state advances only in fixed ticks via Commands; selection/camera/UI are client-local, never simmed; sim time is an integer tick, never wall-clock; all sim randomness via the seeded `Rng` (`Math.random` banned in `sim/`); `Math.sin/cos/tan/atan2/exp/log/pow` banned in sim (cross-engine nondeterministic) — use polynomial approximations.

### Phase 1 — Stabilise ✅ DONE
### Phase 2 — Terrain ✅ DONE (tail items above are optional polish)
### Phase 3 — Sim foundation & determinism harness
Folder restructure into `src/sim/{core,terrain,config,units,movement,combat}`; extract pure `HeightFieldGen` from `TerrainGenerator`; `SimConfig`/`DetMath`/`Checksum`/`commands`/`CommandQueue`/`SimEvents`/`ReplayLog`/`UnitStore`; accumulator loop replacing the current variable-delta rAF; vitest + boundary tests + determinism test. **Exit:** two headless 1,000-tick runs produce identical checksum streams.
### Phase 4 — Selection & movement
Picking, client-local selection, InputManager (ported from `3b6eeea`), NavGrid + A* behind a swappable `PathPlan` (flow-field-ready), formations. **Exit:** 200 units box-selected and moved at 60fps, determinism suite stays green.
### Phase 5 — Combat sandbox = MILESTONE 1
Teams, unit stats, combat + auto-acquire, pooled projectiles, LoS, death/removal, `MatchSession`. **Exit:** 100v100 fight to elimination at 60fps; recorded replay re-runs headless to an identical checksum.
### Phase 6 — Sim hardening (save/replay/cross-browser determinism)
### Phase 7 — Multiplayer lockstep
### Phase 8 — Economy/buildings/production
### Phase 9 — AI & polish

## Session Log
| Date | What Was Done |
|------|---------------|
| Early 2025 | Core engine, units, combat, projectile/LoS fixes (old-main) |
| Mar 2025 | Bloom, edge detection, visual polish (feature/tron-aesthetic) |
| Mar–Apr 2025 | Terrain rebuild, lighting, buffer pooling, performance monitor |
| 28 Mar 2026 | Promoted to main; TerrainControls UI, valley carving, tuned defaults |
| 29 Mar 2026 | Architecture audit; dispose fixes; dual Game instance bug fix; FastNoiseLite swap; 8000×8000 map; edge grid GPU shader |
| 01 Apr 2026 | HeightMap added; source refactor (TerrainGenerator split, config split, stub folders) |
| 10 Aug 2026 | Resumed after break. Verified branch history, pruned stale branches down to `main`. |
| 10–11 Aug 2026 | Wrote the full game-sim architecture plan (multiplayer-first, deterministic, SoA units — see Phase Plan). Finished Phase 2: seed/RNG, deterministic plateau build-sites, `HeightMap.isBuildable`/`isInBounds`, terrain presets. Replaced the old mismatched edge geometry with `TerrainGrid.ts` (one geometry driving both the visual and buildability) and matched render-mesh resolution to grid resolution exactly. Full visual pass: synthwave palette, bloom pipeline (`postprocessing`), fixed a real unclamped-reflection bug (~91% of viewing angles overshot 1.0) and a `smoothstep` NaN bug, reworked the sun to a flat billboard (fixes perspective-curved scanlines, fixed a below-horizon minimum position bug), wired reflection tint to the sun's live colour. Baked in a hand-tuned default scene; built save/load settings (`SettingsIO.ts`) and draggable panels (`Draggable.ts`) along the way, fixing a couple of real bugs found in the process (stale Sun Height display, settings import discarding the saved seed, PerformanceMonitor's index-based DOM lookups breaking once it got a title bar). |
| 11–12 Aug 2026 | **Sun reflection glint saga, ~20 iterative rounds.** Two early approaches (a screen-space camera↔sun alignment hack, then a jittered-normal "let the wedge emerge" attempt) were both proved wrong by a standalone Node simulation (`tools/simulate-sun-glitter.js`, still maintained) rather than by further hand-reasoning, which had gotten it wrong twice already. Settled on an explicitly-authored wedge envelope along the real camera→sun ground axis (`calculateSunGlitter()`), textured with grid-aligned shard sparkle. Along the way, found and fixed several real, non-obvious bugs: three unrelated "ambient shine" terms (never reading the sun's position at all) were outshining the actual sun-tracking term; Three.js's own built-in PBR specular highlight was reacting independently to the real light, separate from any custom shader code; the glint needed to be emissive to stay visible at low light levels (`MeshStandardMaterial` is lit, diffuse-only output was invisible in a dim scene); `roughnessFactor`/`metalnessFactor` were re-triggering Three's built-in highlight on top of the shard pattern; the shard texture needed grid-cell flooring instead of per-pixel noise, then exact alignment to the visible neon grid. Extensively tuned after that: auto width-vs-sun-height curve, falloff shape, per-shard radial glow, low-sun brightness boost — confirmed-good defaults eventually baked in (see Active Tuning Notes). Added terrain valley rotation as a side feature in the same period. Diagnosed a related bug (no glint when the sun is behind the camera — traced to a deliberate `inFront` gate in the wedge design, not physically-expected sparsity) and added a second term, `calculateBackGlint()`, which passed all automated shape checks in simulation but **did not fix the issue in live testing** — logged as the current open item, see Known Issues at the top of this file. Full round-by-round detail is in git history if ever needed. |
| 12 Aug 2026 | Began Phase 2.5 stabilisation on `feature/phase-2-5-stabilisation`. Fixed a coordinate-space mismatch in `TerrainMaterial.ts`: the custom reflection shader was comparing a view-space normal (`normalMatrix * normal`) with world-space sun/camera/fragment vectors. `vWorldNormal` now converts back through Three's `inverseTransformDirection(..., viewMatrix)`. Typecheck, Webpack and numerical checks passed; live testing then confirmed the forward glint is substantially better targeted and the back glint works reasonably well. Minor panel-edge bleed is deferred as non-blocking polish. |
| 12 Aug 2026 | Centralised reflection/glitter ownership in `TerrainReflectionState`: controls and shader uniforms now share live vectors, regenerated materials reuse the current values, and uniform edits no longer trigger shader recompilation. Sun settings export the live intensity target, and the intensity slider now also affects terrain illumination rather than being overwritten every frame. |
| 12 Aug 2026 | Fixed `HeightMap.worldToGrid()` boundary extrapolation: fractional grid coordinates are now clamped before cell/fraction derivation, so off-map queries resolve to edge heights and edge normals no longer sample invented values. |
| 12 Aug 2026 | Hardened regeneration/HMR cleanup: terrain child grid geometry/material now dispose on every regeneration, surface buffers retain their separate BufferPool release path, `TerrainGenerator` handles async initialise/regenerate disposal races, and `Game.dispose()` is idempotent and disposes OrbitControls safely. |
| 12 Aug 2026 | Corrected the performance overlay: Three.js `renderer.info.memory` geometry/texture values are now labelled as resource counts instead of being multiplied by 1 KiB and presented as invented GPU-memory megabytes. |
| 12 Aug 2026 | Removed ambiguous grid configuration and dead runtime mutation APIs. World size, build-cell size/count, and height-sample spacing/count now have explicit names; counts are derived from sizes. The current renderer asserts its temporary one-height-segment-per-build-cell requirement, leaving a clear seam for denser deformable terrain later. |
| 12 Aug 2026 | Fixed edge colour-ramp ordering: defaults now progress 8%→10% instead of 10%→8%, layer thresholds are normalized as complete model state on import/material creation, and live sliders cannot cross neighbouring thresholds. |
| 12 Aug 2026 | Added the project verification gate: dedicated full/sim typechecks, Vitest run/watch commands, production build mode, and `npm run verify`. Initial 19-test suite covers HeightMap boundaries, grid conversions, edge-ramp invariants, deterministic RNG golden output/state resume, and numeric bounds. `package-lock.json` is now tracked for repeatable installs. |

---
*Update this file at the end of every coding session.*
*Claude Code reads this automatically at session start.*
