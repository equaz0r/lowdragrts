# LowDrag RTS — Main Game Plan

**Date:** 12 August 2026  
**Status:** Authoritative plan for future development and AI-assisted coding sessions  
**Project:** Browser-based, heightmap-driven real-time strategy game inspired by *Total Annihilation*

---

## 1. Read This First

### The short version

Do not restart the whole project.

Keep the existing terrain and rendering prototype. Fix the small group of known correctness and ownership problems, then build the gameplay simulation as a new, deterministic layer.

The intended terrain model is now settled:

- The world uses a connected heightmap mesh, not voxels.
- Terrain destruction is a hard requirement.
- Damage lowers or reshapes height samples.
- Peaks can be reduced and explosions can form craters.
- The terrain surface, neon grid, normals, buildability, navigation and line-of-sight data must all update from the same authoritative heightfield.
- Caves, tunnels, overhangs and holes through the world are not required.

### Immediate order of work

1. Complete **Phase 2.5 — Stabilisation**.
2. Build **Phase 3A — Minimal deterministic simulation**.
3. Build **Phase 3B — Shared mutable terrain and static units**.
4. Add selection and movement.
5. Add combat and terrain-deforming explosions.
6. Prove save/replay and cross-browser determinism.
7. Add multiplayer before the economy becomes large.

### First playable milestone

Two teams of units can be spawned, selected, moved and ordered to fight on the generated terrain. A 100-vs-100 match runs smoothly, terrain can be cratered by appropriate weapons, and a recorded match replays to the same final checksum.

---

## 2. Purpose and Source of Truth

This document combines:

- The current repository and source-code audit.
- The useful parts of the external `ok-yeah-looks-good-ticklish-locket - lowdragrts plan.md` master plan.
- The current `CLAUDE.md` architecture decisions and lessons.
- The decision to support destructible heightmap terrain without returning to voxels.
- A revised, smaller-step roadmap suitable for intermittent hobby development and AI-assisted sessions.

When documents disagree, use this priority:

1. **This file** — target architecture, locked decisions and roadmap.
2. **`CLAUDE.md`** — current implementation status, active bugs, tuned constants and session log.
3. **`README.md`** — setup and public-facing project overview.
4. Files in `docs/` and `archive/` — historical context only unless explicitly brought up to date.

Future sessions should not treat old claims about a voxel engine, React UI, completed state machine, dynamic LOD or old branch names as current facts. Much of the existing `docs/` directory describes previous versions of the project.

### Documentation rule

At the end of each meaningful coding session:

- Update `CLAUDE.md` with what actually changed, new gotchas and the next concrete task.
- Update this plan only if scope, architecture, phase boundaries or a locked decision changed.
- Update `README.md` when setup, commands, controls or user-visible status changed.
- Do not turn any of these files into a line-by-line diary. Git history holds implementation detail.

---

## 3. Product Vision and Locked Requirements

### Game identity

LowDrag RTS is a browser-based, large-map real-time strategy game with:

- A strong synthwave visual identity.
- Procedurally generated terrain.
- Large battles inspired by *Total Annihilation*.
- Meaningful terrain, line of sight, projectile travel and positioning.
- Base building and a multi-resource economy in later phases.
- Multiplayer as a real product goal, not a retrofit.

### Locked technical/product decisions

These decisions must not be casually reversed during implementation:

1. **Multiplayer is a hard goal.**
   The simulation must be designed for deterministic lockstep from its first real gameplay system.

2. **Hundreds of units are a hard scale goal.**
   Design for at least 300 active units and benchmark above that. Simulation data uses structure-of-arrays storage. Repeated unit visuals use instancing.

3. **Milestone 1 is a combat sandbox.**
   Prove movement, targeting, projectiles, damage, death and replay before menus, a full economy or campaign systems.

4. **Terrain destruction is important.**
   The heightmap is mutable during a match. Explosions and suitable weapons can lower and reshape it.

5. **Voxels are not required.**
   Heightmap deformation meets the desired result and fits the current engine. The accepted limitation is no caves, overhangs or tunnels.

6. **Simulation and rendering remain separate.**
   Three.js, the DOM, camera controls, selection visuals and post-processing do not belong in deterministic simulation code.

7. **The existing old gameplay code is a rewrite guide, not a port.**
   In particular, do not restore the old `Unit extends THREE.Object3D` design.

### Important but not yet locked

These should stay configurable or be decided through prototypes:

- Exact unit roster and balance.
- Exact resource rates and tech tree.
- Whether all weapons deform terrain or only explosive/heavy weapons.
- Whether craters include raised rims.
- Whether fine terrain sampling is needed after the first combat milestone.
- Final multiplayer transport choice: WebRTC DataChannel or a WebSocket relay.
- Final art pipeline for units and buildings.

---

## 4. Current Project Assessment

### What currently works

- TypeScript builds and type-checks successfully.
- Procedural FastNoiseLite terrain with domain warp and ridged peaks.
- Region-masked flatland/mountain zoning.
- Deterministically positioned plateau build sites.
- Rotatable valley corridor.
- A retained heightmap with height, normal, slope, bounds and buildability queries.
- One logical terrain grid used for visible neon lines and cell buildability.
- A closed terrain-chunk presentation mesh: four metallic violet walls follow the boundary height samples and connect to a flat underside below the terrain minimum; a separate unlit grid overlay keeps the sides readable in dark lighting.
- Dynamic sun, sky and halo.
- Terrain reflection/glitter shader and debug isolation view.
- Edge-grid height colour ramp and pulse shader.
- Bloom, tone mapping, grading and vignette.
- Terrain, grid and reflection tuning controls.
- JSON settings export/import.
- Draggable panels with persisted positions.
- Performance overlay.
- Deterministic `Rng` implementation.
- A standalone numerical sun-glitter simulator.

### What is not implemented

- Fixed-tick simulation loop.
- Commands, command queue or replay log.
- Simulation checksums.
- Unit storage or unit rendering.
- Selection and RTS input.
- Navigation, formations or movement.
- Combat, projectiles or line of sight.
- Terrain mutation during a match.
- Resources, buildings, production or AI.
- Multiplayer transport or lockstep scheduler.
- Automated test suite, linter or full verification command.

### Overall verdict

The current code is a useful terrain/rendering prototype, not yet a game engine. That is acceptable. Its visual work and terrain concepts should be retained.

The project does **not** need a whole-project rewrite. It does need:

- A short stabilisation pass.
- A clean simulation boundary.
- A pure, shared terrain-data model.
- Fresh gameplay systems designed around deterministic state and high unit counts.

---

## 5. What to Keep, Refactor or Rebuild

| Area | Decision | Reason |
|---|---|---|
| Terrain look and procedural concepts | Keep | Strong prototype and clear identity |
| Noise sampler | Keep initially, then move behind pure terrain generation | Useful and already tuned |
| `Rng.ts` | Keep and test | Appropriate deterministic generator |
| `TerrainMaterial.ts` | Fix, then minimise changes | Valuable but fragile shader injection |
| `EdgeMaterial.ts` | Keep with validation fixes | Useful GPU-driven visual grid |
| `LightingSystem.ts` | Keep, reduce dead/conflicting state | Visually developed, but too much state currently overlaps |
| `TerrainGenerator.ts` | Refactor | It currently owns generation, data, rendering, controls and regeneration lifecycle |
| `HeightMap.ts` | Replace with/route through pure `SimHeightField` | Current class imports Three.js and is unsuitable as authoritative simulation state |
| `GridSystem.ts` | Simplify and separate concepts | Current `DIVISIONS`, cell size and derived cell count are inconsistent |
| Debug tuning panels | Keep | Useful development tools |
| Settings system | Refactor to one source of truth | Current shader rebuild/regeneration can discard live values |
| `BufferPool.ts` | Keep temporarily | Remove later if profiling does not justify it |
| Old unit/combat implementation | Do not port wholesale | It mixes simulation, visuals, wall time and scene objects |
| New gameplay simulation | Build fresh | Required for determinism, replays, multiplayer and scale |
| Current historical docs | Archive or rewrite | Several describe systems that do not exist |

---

## 6. Target Architecture

```text
src/
├── sim/                              # Deterministic, headless game state
│   ├── core/
│   │   ├── SimWorld.ts
│   │   ├── SimConfig.ts
│   │   ├── Rng.ts
│   │   ├── DetMath.ts
│   │   ├── Checksum.ts
│   │   ├── commands.ts
│   │   ├── CommandQueue.ts
│   │   ├── SimEvents.ts
│   │   ├── ReplayLog.ts
│   │   ├── SpatialHash.ts
│   │   ├── Players.ts
│   │   └── MatchSetup.ts
│   ├── terrain/
│   │   ├── TerrainConfig.ts          # Numeric/plain-data config; no THREE.Color
│   │   ├── HeightFieldGen.ts         # Pure initial generation
│   │   ├── SimHeightField.ts         # Authoritative mutable heights
│   │   ├── TerrainDeformation.ts     # Crater/lowering operations
│   │   └── TerrainDirtyRegion.ts
│   ├── config/
│   │   └── UnitTypes.ts
│   ├── units/
│   │   └── UnitStore.ts
│   ├── movement/
│   │   ├── NavGrid.ts
│   │   ├── Pathfinder.ts
│   │   ├── PathPlan.ts
│   │   ├── Formation.ts
│   │   └── MovementSystem.ts
│   └── combat/
│       ├── CombatSystem.ts
│       ├── ProjectileStore.ts
│       └── LineOfSight.ts
│
├── engine/                           # Rendering, browser and local interaction
│   ├── render/
│   │   ├── TerrainRenderer.ts
│   │   ├── TerrainGridRenderer.ts
│   │   ├── UnitRenderer.ts
│   │   ├── ProjectileRenderer.ts
│   │   └── OverlayCanvas.ts
│   ├── input/
│   │   ├── InputManager.ts
│   │   ├── PickingService.ts
│   │   ├── SelectionSystem.ts
│   │   └── CommandEmitter.ts
│   ├── terrain/                      # Existing shader/lighting presentation code
│   ├── ui/
│   ├── debug/
│   └── config/
│
├── game/
│   ├── AppState.ts                   # Boot -> sandbox -> later menus/matches
│   └── MatchSession.ts               # Composition root for one match
│
└── main.ts

test/
├── boundaries.test.ts
├── determinism.test.ts
├── replay.test.ts
├── heightfield.test.ts
├── deformation.test.ts
├── unitstore.test.ts
├── pathfinder.test.ts
└── combat.test.ts
```

### Dependency direction

```text
Browser input/UI ──> Commands ──> SimWorld ──> Sim events/snapshots
                                      │
                                      ▼
                                SimHeightField
                                      │
                ┌─────────────────────┼────────────────────┐
                ▼                     ▼                    ▼
         Terrain rendering       Navigation/LoS       Buildability
```

Rules:

- `src/sim/` imports nothing from `engine/` or `game/`.
- `src/sim/` imports no Three.js, DOM or browser APIs.
- Engine and game code may import simulation types and read simulation state.
- Rendering never directly changes simulation state.
- Selection, hover, camera, UI layout and control groups are client-local.
- A `MatchSession` owns one complete match and its cleanup. Avoid global match state.

---

## 7. Deterministic Simulation Contract

### Fixed time

- Target simulation rate: **20 ticks per second**.
- `SIM_DT_MS = 50`.
- Simulation time is an integer tick, not wall-clock time.
- Cooldowns, construction time, projectile lifetime and status durations are tick counts.
- The renderer may continue using wall time for purely visual effects such as the neon pulse.

### Main loop

Use an accumulator around `requestAnimationFrame`:

1. Measure real elapsed time.
2. Clamp a single frame gap to 250 ms.
3. Add scaled time to the accumulator.
4. Step the simulation in exact 50 ms ticks.
5. Limit to 5 simulation steps per render frame to prevent a spiral of death.
6. Render using `alpha = accumulator / SIM_DT_MS` to interpolate previous/current transforms.

Initial simulation speed options: `0`, `0.5`, `1`, `2`, `4`.

- Speed `0` is pause.
- Browser visibility loss should auto-pause local/single-player development matches.
- Multiplayer pause behaviour will be a match-level rule, not a local browser side effect.

### Commands

All external simulation mutations enter as tick-stamped commands.

```ts
const enum CommandType {
    Spawn,
    Move,
    AttackTarget,
    Stop,
}

interface CommandBase {
    tick: number;
    playerId: number;
    seq: number;
}
```

Initial command payloads:

- `Spawn { unitType, x, z, count }`
- `Move { unitIds, x, z }`
- `AttackTarget { unitIds, targetId }`
- `Stop { unitIds }`

Rules:

- Local commands target `currentTick + INPUT_DELAY_TICKS`.
- Initial input delay: 2 ticks, or 100 ms.
- At a tick, sort commands by `(playerId, seq)` before applying them.
- Commands must be JSON-serialisable.
- Unit references use generation-packed handles so stale references safely no-op.
- Terrain deformation caused by a projectile is a deterministic internal simulation effect. It is derived from the projectile impact and does not need a separate player/network command.
- Debug/admin terrain deformation, if exposed, must use a tick-stamped command.

### Randomness

- All simulation randomness uses named `Rng` streams.
- Suggested streams: `terrain`, `spawn`, `combat`, `resources`, `ai`.
- `Math.random()` is banned under `src/sim/`.
- Adding a random draw to one system must not shift another system's sequence.

### Numeric determinism

Under `src/sim/`, ban or isolate functions known to vary subtly between engines:

- `Math.sin`, `cos`, `tan`, `atan2`
- `Math.exp`, `log`, `pow`, `hypot`

Use deterministic approximations, integer comparisons, lookup tables or precomputed kernels where needed.

Allowed basic tools include integer/bitwise operations and carefully controlled `fround`, `sqrt`, `floor`, `ceil`, `round`, `trunc`, `min`, `max` and `abs`. Any use that becomes cross-browser sensitive must be covered by the determinism suite.

For terrain state, prefer quantised integer/fixed-point heights over continuously accumulated floating-point subtraction. This avoids repeated crater operations drifting between engines.

### Ordering

- Do not rely on insertion-order side effects unless the order is explicitly part of the contract.
- Do not use unordered `Map`/`Set` iteration for state mutation.
- Iterate unit arrays by ascending slot index.
- Process dirty terrain bounds and deformation operations in deterministic order.
- End-of-tick removals happen in a dedicated, ordered cleanup pass.

### Checksums and replay

Every tick produces a 32-bit checksum over authoritative state, including:

- Tick number.
- Player state.
- Unit and projectile stores.
- RNG states.
- Mutable terrain state or its verified cached hash.
- Other future simulation-owned resources/buildings.

Every match records:

- Format/schema version.
- Match setup.
- Initial terrain seed/config and, when required, the quantised initial heightfield.
- Player commands.
- Periodic checksum stream.

Derived projectile impacts and crater operations do not have to be duplicated in the replay if replaying commands deterministically reproduces them. Logging them as optional debug events is useful for divergence diagnosis.

---

## 8. Authoritative Terrain Model

### Key decision

`SimHeightField` owns terrain height during a match.

It is the only authoritative source used by:

- Surface rendering.
- Neon grid rendering.
- Terrain normals.
- Unit grounding.
- Building placement/buildability.
- Navigation and path validation.
- Projectile-to-ground collision.
- Line of sight.
- Save/load, replay and checksums.

The renderer may cache GPU-ready copies, but it must not own a separate truth.

### Initial data

The initial heightfield is generated once from:

- Terrain generation version.
- Seed.
- Numeric terrain configuration.
- Map dimensions and height sample spacing.

The result is quantised into the simulation height representation before the match begins.

Recommended first representation:

- `Int32Array` height samples.
- Fixed-point scale documented in `SimConfig`, for example 1/16 world unit per integer step.
- Conversion to floating-point world Y happens at the engine/render boundary.

The map currently has 126 x 126 samples at 64-unit spacing, only 15,876 values. The storage and checksum cost is small.

### Initial terrain determinism risk

FastNoiseLite cross-browser equality has not yet been proved. Before multiplayer:

1. Run the same terrain checksum in current Chrome and Firefox.
2. If it matches, keep seed/config generation for normal lockstep setup.
3. If it does not match, the match host generates and transmits the quantised initial heightfield once.

After match start, all terrain deformation must be deterministic regardless of which initialisation method is used.

### Terrain and building grid terminology

The current code mixes `DIVISIONS`, cell count and cell size. Replace this with explicit concepts:

- `WORLD_SIZE`: total map width/depth.
- `BUILD_CELL_SIZE`: logical placement/navigation cell size, initially 64.
- `BUILD_CELL_COUNT`: derived from `WORLD_SIZE / BUILD_CELL_SIZE`, initially 125.
- `HEIGHT_SAMPLE_SPACING`: terrain vertex spacing, initially 64.
- `HEIGHT_SAMPLE_COUNT`: derived, initially 126 samples per axis.

Initially, height samples and build-cell corners remain one-to-one. The names must still be separate so terrain resolution can later increase without changing building footprints.

---

## 9. Destructible Heightmap Terrain

### What is possible

The existing connected heightmap approach can support:

- Craters.
- Lowered hills and peaks.
- Flattened or damaged ridges.
- Channels/trenches carved downward.
- Local terrain smoothing.
- Later, optional raised crater rims or construction terraforming.

Triangles remain connected because no vertices or indices are deleted. Only vertex heights change.

### Accepted limitations

A single-valued heightfield cannot represent:

- Caves.
- Tunnels.
- Overhangs.
- Arches.
- A hole with terrain above it.
- Truly vertical cliff faces.

These are out of scope unless the project later adopts a different terrain representation.

### Resolution limitation

At the current 64-unit height sample spacing:

- Large craters and damaged peaks are practical.
- A crater should usually have a radius of at least 2–3 samples, roughly 128–192 world units, to have a readable shape.
- Tiny bullet or shell impacts cannot produce attractive real geometry deformation.

For the first combat milestone:

- Small impacts use decals, particles, scorch marks or other visual-only feedback.
- Heavy explosives/artillery use real heightfield deformation.

If finer deformation becomes important, lower `HEIGHT_SAMPLE_SPACING` to 32 or 16 while keeping `BUILD_CELL_SIZE = 64`. The visible build grid then samples/interpolates the finer heightfield at grid-line positions. Do not make buildings smaller merely to gain more terrain vertices.

### Deformation operation

Use a plain-data operation similar to:

```ts
interface TerrainDeformation {
    tick: number;
    sourceId: number;
    sequence: number;
    kind: TerrainDeformationKind;
    centerX: number;       // fixed-point or quantised world coordinate
    centerZ: number;
    radius: number;
    depth: number;
    rimHeight?: number;
    profileId: number;
    noiseSeed?: number;
}
```

The exact public type can change, but ordering and numeric meaning must be explicit.

Initial deformation kinds:

- `Crater`: lower most at the centre, smoothly fade to zero at the radius.
- `Lower`: broad lowering for peak damage or scripted effects.
- `Flatten`: optional later operation for construction/terraforming.

### Deterministic crater algorithm

For every height sample inside the operation's integer bounding box:

1. Compute integer `dx`, `dz` from the crater centre.
2. Compare squared distance against squared radius.
3. Obtain falloff from a deterministic integer formula or versioned lookup table.
4. Convert `depth * falloff` to a fixed-point height delta.
5. Lower the height sample.
6. Optionally add a separately defined rim term near the crater boundary.
7. Clamp to the configured minimum world height.
8. Record the changed sample bounds.

Do not use unversioned `Math.exp`, trigonometry or other engine-sensitive functions in the simulation crater calculation.

Possible initial profile:

```text
centre                              edge
maximum lowering ───────── smooth rise ── zero lowering
```

The crater should deform the existing surface rather than replace it with a fixed bowl elevation. Therefore:

- An explosion on a peak makes the peak smaller.
- An explosion on flat ground makes a crater.
- Repeated explosions deepen or widen existing damage.

All profile behaviour must be unit tested at centre, edge, outside radius, map boundary and overlapping-crater cases.

### Dirty-region contract

Each deformation returns a rectangular dirty sample region:

```ts
interface TerrainDirtyRegion {
    minSampleX: number;
    minSampleZ: number;
    maxSampleX: number;
    maxSampleZ: number;
    terrainRevision: number;
}
```

The region must be expanded where needed:

- One sample beyond changed heights for correct neighbour-derived normals.
- Relevant adjacent build/navigation cells.
- Any extra line endpoints duplicated by the neon grid geometry.

Multiple dirty regions in one tick may be merged before rendering or navigation updates.

### Render updates

The terrain renderer observes completed simulation ticks and applies dirty regions:

1. Copy changed height samples into terrain vertex Y positions.
2. Recalculate normals for changed samples plus their one-sample border.
3. Mark only affected GPU attribute ranges dirty where practical.
4. Update bounding volumes when deformation can invalidate them.
5. Update the neon grid line endpoints from the same heightfield.
6. If a dirty region touches the map boundary, update the matching terrain-chunk wall rim and side-grid top outline from the same height samples. The flat underside does not change.

Do not call full procedural terrain regeneration after an explosion.

The current surface, grid and terrain-chunk walls use separate geometry buffers. That is acceptable only if all are projections of the same `SimHeightField`. Precompute the mapping from a height sample to duplicated grid-line/wall-rim Y entries, or update the affected grid rows/columns/boundary segments deterministically.

The current map is small enough that a full position/normal upload may be acceptable as an early implementation. Measure it. Keep the dirty-region API from the beginning so optimisation does not require changing simulation contracts.

### Buildability updates

After deformation:

- Recalculate affected cells' slope and height spread.
- Mark a building footprint invalid if any required cell is no longer buildable.
- Existing buildings need a later explicit rule: remain anchored, take structural damage, collapse, or protect/fix their foundation. Do not silently move buildings with the ground.

For the combat sandbox, it is enough to update the buildability map even though buildings do not yet exist.

### Navigation updates

`NavGrid` must support local rebaking:

- Recompute walkability and movement cost for dirty cells.
- Increase a `terrainRevision`/`navRevision` when results change.
- Each `PathPlan` records the revision it was built against.
- Units validate upcoming path segments when the revision changes.
- Replan only affected or invalid paths; do not repath every unit after every crater.

A crater may create an obstacle, remove a steep obstruction, or open/close a route.

### Projectiles and line of sight

- Projectile-to-ground collision samples the current `SimHeightField`.
- A projectile impact applies deformation at a deterministic tick.
- Later projectiles and line-of-sight tests see the updated terrain immediately from the next defined system step/order.
- System order must be documented, for example:

```text
commands -> movement -> target/LoS -> projectile movement/impacts
-> terrain deformation -> damage/death cleanup -> checksum/events
```

If the exact order changes, update replay/simulation versioning.

### Terrain checksum and saves

Mutable terrain is simulation state.

- Include it in save snapshots.
- Include it in desync checks.
- Restore it before rebuilding navigation or rendering.
- Version the heightfield format and deformation profiles.

With roughly 16,000 samples, hashing the complete terrain after a deformation is affordable. A cached terrain hash can be reused on ticks without changes. Prefer correctness and clear diagnostics before clever incremental hashing.

---

## 10. Unit Storage and Rendering

### UnitStore

Use a fixed-capacity structure-of-arrays store, initially `MAX_UNITS = 1024`.

Likely arrays:

- Position: current and previous X/Y/Z.
- Velocity X/Z.
- Current and previous heading.
- Health.
- Move target.
- Type, team, player and state.
- Target handle.
- Next attack tick.
- Alive flag and generation counter.

Use generation-packed handles:

```text
handle = (generation << 16) | index
```

- Free-list allocation is deterministic.
- Iterate slots in ascending order, skipping dead entries.
- Removal occurs during an ordered end-of-tick pass.
- Previous transform arrays are the render interpolation snapshot.

Decide exact Float32/Float64/fixed-point position storage during Phase 3A through determinism and performance tests. Do not allow the renderer's Three.js vectors to become authoritative.

### UnitRenderer

- One or a small number of `InstancedMesh` objects per unit visual/type.
- Render transforms interpolate between previous and current simulation state.
- Team colour is an instance attribute or other batched property.
- Selection rings, health bars and death feedback should not create a large object hierarchy per unit.
- A 2D overlay or batched/instanced approach is preferred for health bars and selection feedback.

Exit target before movement work expands:

- 300 static units render at 60 FPS on the target development machine.
- No per-unit `Object3D` simulation ownership.

---

## 11. Input, Selection and Movement

### Local-only interaction

The following are never part of the deterministic state:

- Hovered unit.
- Currently selected units.
- Drag rectangle.
- Camera position/zoom.
- Control groups.
- Local UI panel state.

Only the resulting gameplay command enters the simulation.

### Input

The old `InputManager` may be used as a reference or carefully ported because its key-state/control-group concepts are useful. Remove assumptions tied to the old object-based unit model.

Suggested RTS mapping for the new implementation:

- Left click/drag: select.
- Right click: contextual move/attack command.
- Middle mouse: orbit, or another mapping that avoids fighting selection.
- `S`: stop.
- Number keys: recall control group.
- Ctrl + number: assign control group.
- Escape: cancel local interaction state.

### Picking

- Terrain picking: raycast or heightfield ray-march against the rendered/current terrain.
- Unit picking: avoid raycasting hundreds of individual nested meshes. Use projected screen positions, a spatial structure or batched instance picking.
- Box selection operates in screen space and returns local unit handles.

### Navigation

Initial navigation grid:

- 64-unit cells matching `BUILD_CELL_SIZE`.
- 125 x 125 cells on the current 8,000-unit world.
- Walkability sampled from `SimHeightField` using normal/slope comparisons without `acos`.
- Five samples per cell is a reasonable initial bake: centre and four representative edges/corners.

Use A* behind a `PathPlan`/`Pathfinder.plan()` abstraction so flow fields can replace or complement it later without changing command or movement call sites.

Initial movement approach:

- One shared high-level path per move order.
- Formation offsets based on stable unit ordering.
- Spatial hash for local separation.
- Terrain grounding from `SimHeightField`.
- Heading from deterministic math.
- Validate paths after terrain revisions.

Exit target:

- 200 units can be box-selected and moved smoothly.
- Units remain in bounds and on traversable terrain.
- Movement replay produces identical checksums.
- A crater can invalidate a route and cause bounded replanning.

---

## 12. Combat Sandbox

### Teams and targeting

- Hostility is based on different team IDs, not player IDs alone.
- Validate generation-packed target handles before use.
- Units in range can stand and fire.
- Idle units acquire the nearest valid hostile through the spatial hash.
- Stagger acquisition work, for example every 5 ticks by `unitIndex % 5`.

### Unit stats

Use a plain record keyed by unit type. Avoid Three.js types in stats.

Initial data includes:

- Radius and height.
- Max health.
- Speed and turn rate.
- Acquisition and attack range.
- Damage.
- Cooldown ticks.
- Projectile speed/lifetime.
- Terrain-deformation profile for weapons that can damage terrain.

### Projectiles

- Use a pooled structure-of-arrays store.
- Initial capacity: `MAX_PROJECTILES = 2048`.
- Use swept segment collision rather than point-only collision.
- Test units and current terrain.
- Lifetime uses ticks, initially capped around 60 ticks unless weapon design requires more.
- Terrain hits may emit both damage effects and a `TerrainDeformation`.

### Line of sight

- Ray-march against `SimHeightField`.
- A 20-world-unit step is an initial value, not a permanent tuning decision.
- Run at acquisition/validation cadence, not blindly for every unit every tick.
- Re-evaluate when terrain revision changes if the old sight line crossed a dirty area.

### Death

- Collect deaths during systems.
- Remove units in an ordered end-of-tick pass.
- Emit `UnitDied` events for the engine.
- Renderer frees instance slots and removes local selection references.
- Effects do not own or modify simulation state.

### Milestone exit criteria

- 100-vs-100 fight reaches elimination.
- Target development machine remains near 60 FPS.
- No pool/instance leaks after mass death.
- Heavy explosions form visible connected craters.
- Surface, grid, normals, navigation and LoS agree after deformation.
- A recorded match replays headlessly to the identical final checksum.

---

## 13. Economy and Later Game Systems

These remain planned after multiplayer is proven on the smaller combat game.

### Resources

Current design names/concepts:

- **Skirulum** — primary construction material.
- **Vlux** — energy resource, potentially affected by the day/night cycle.
- **Fredalite** — rare strategic resource.
- **Scrap** — recovered from destroyed units/buildings.

Exact balance and logistics are not locked. Keep resource state simulation-owned and command-driven.

### Buildings and production

- Free placement on valid terrain cells.
- Footprints initially use 1x1, 2x2 and 3x3 build cells.
- Builder-driven construction.
- Factories and production queues.
- Placement tests current mutable terrain.
- Foundation and terrain-damage behaviour must be explicitly designed before buildings ship.

### AI

- AI issues the same commands as a human player.
- It receives simulation-readable state, not renderer objects.
- This makes AI legal under replay and multiplayer lockstep rules.

---

## 14. Required Stabilisation Before Gameplay

Complete these as **Phase 2.5**. Keep this work bounded; do not continue indefinite visual polishing.

### 14.1 Fix shader coordinate spaces

Current problem:

- `TerrainMaterial.ts` assigns `normalMatrix * normal` to `vWorldNormal`.
- Three.js `normalMatrix` produces a view-space normal.
- The shader compares that result with world-space sun position, camera position and fragment position.
- This coordinate-space mismatch can make glint behaviour change incorrectly as the camera orbits and likely explains why the standalone world-space simulator passes while the live shader does not.

Fix by ensuring every vector in those dot products uses the same coordinate space. Add a focused live/debug verification before retuning constants.

Do not change glint tuning until this correctness bug is fixed.

### 14.2 Centralise reflection and scene settings

**Status: completed on `feature/phase-2-5-stabilisation`. Shared live reflection state preserves regeneration/recompile values; versioned scene imports now validate, clamp and migrate legacy partial exports.**

Current problems:

- Reflection controls clone defaults and update the current shader.
- Setting `material.needsUpdate` recompiles the shader and can restore default uniform values.
- Terrain regeneration creates a new material and loses live reflection/glitter values.
- Sun intensity export reads a config constant rather than the live target value.
- The documented Sun Intensity control is partly overwritten by height-driven lighting logic.

Required result:

- One typed scene-settings model owns values.
- UI edits update that model.
- New/recompiled materials initialise from that model.
- Regeneration preserves all scene settings.
- Save/load validates and migrates versioned input.
- Remove or correctly wire controls that currently have no reliable effect.
- Uniform-only edits do not set `material.needsUpdate`.

### 14.3 Fix HeightMap bounds

Current problem:

- `worldToGrid()` clamps integer cell indices but leaves fractional offsets based on the unclamped world point.
- Out-of-bounds queries can extrapolate instead of returning a clamped edge value.
- Edge normals and future navigation/LoS can therefore be wrong.

Required result:

- Clamp the fractional grid coordinates before deriving cell/index/fraction.
- Add tests for all four edges, corners and outside-map positions.
- Keep `isInBounds()` for callers that need rejection rather than clamping.

### 14.4 Fix terrain/grid lifecycle and disposal

Check and correct:

- Dispose child terrain-grid geometry and material during regeneration.
- Dispose `OrbitControls` in `Game.dispose()`.
- Make disposal safely idempotent for HMR/beforeunload overlap.
- Guard DOM removal with a parent check.
- Verify singleton cleanup order.
- Regenerate repeatedly while monitoring renderer geometry counts.

### 14.5 Correct performance reporting

`renderer.info.memory.geometries` and `.textures` are object counts, not byte counts. Stop displaying them as fabricated megabytes.

Report:

- Geometry count.
- Texture count.
- Draw calls.
- Triangles/lines/points.
- Browser heap information only when genuinely available.

GPU-memory estimation can be added later if it is calculated from known buffer/texture formats.

### 14.6 Simplify grid configuration

**Status: completed on `feature/phase-2-5-stabilisation` (`a5408f1`).**

Current defaults say `DIVISIONS = 100`, while `8000 / 64 = 125` and terrain generation actually uses 125 cells. Some setters change values the renderer ignores.

Replace this ambiguity with the explicit terminology in Section 8. Remove or fully wire unused setters.

### 14.7 Validate edge colour layers

**Status: completed on `feature/phase-2-5-stabilisation`. Ascending model thresholds are enforced; colour/intensity records are never reordered.**

The default height fractions are not monotonic (`0.10`, then `0.08`), while the shader assumes a low-to-high ramp. The current `sortedHeights` calculation does not truly sort or enforce increasing values.

Choose one clear behaviour:

- Enforce ascending layer thresholds in the UI/model, or
- Sort complete layer records together so colour/intensity stay attached to their threshold.

Never sort only heights separately from their colours.

### 14.8 Add project verification

**Status: completed on `feature/phase-2-5-stabilisation`. `npm run verify` is the required pre-commit/merge check.**

Add:

- `typecheck`
- `typecheck:sim`
- `test`
- `test:watch`
- `verify`
- Vitest configuration.
- Simulation boundary tests.
- Determinism smoke test.

Recommended `verify` order:

```text
typecheck -> typecheck:sim -> unit/integration tests -> production build
```

### 14.9 Dependency/build cleanup

**Status: completed on `feature/phase-2-5-stabilisation`.**

After confirming no usage, remove:

- `dat.gui`
- `@types/dat.gui`
- `simplex-noise`
- `simplex-noise-esm`
- Its stale declaration file.
- `raw-loader` and unused shader module declarations/rule if shaders remain inline.
- Unused Babel and HTML plugin dependencies if still unreferenced.

Move build-only packages such as TypeScript/`ts-loader` into `devDependencies`.

Commit `package-lock.json`; do not ignore it. It is needed for repeatable installs and future CI.

Make `npm run build` a real production build. Keep development source maps/server behaviour in the development command.

### 14.10 Documentation cleanup

**Status: completed on `feature/phase-2-5-stabilisation`. Historical files are retained but clearly bannered; current sources of truth are indexed in `docs/README.md`.**

Move clearly obsolete files in `docs/` into `archive/` or add a large historical warning. In particular, current docs incorrectly mention systems such as React UI, a completed state machine, dynamic LOD and `npm run dev`.

Copy this plan into the repository permanently—this file fulfils that requirement. The external plan should no longer be the only detailed source.

### 14.11 Player-facing terrain and scene sharing

**Status: completed on `feature/phase-2-5-stabilisation`.**

- Terrain Seed is a visible unsigned 32-bit number (maximum 10 decimal digits). It controls terrain RNG and deliberately retains the current terrain-generation sliders.
- Lighting Code uses the `LDR-L1-` prefix and contains the sun/reflection settings required to restore that look.
- Full Scene Code uses the `LDR-S1-` prefix and contains terrain seed/config, grid appearance and lighting.
- Codes are reversible versioned payloads rather than hashes; readable full-scene JSON remains available as the durable debugging/export format.

---

## 15. Phase Plan

Each phase is deliberately narrow enough to complete and verify in intermittent sessions.

### Phase 1 — Stabilise

**Status:** Complete historically.

The project builds, launches and has a stable terrain/rendering baseline.

### Phase 2 — Terrain and visual prototype

**Status:** Functionally complete, with Phase 2.5 corrective work outstanding.

Delivered:

- Procedural terrain.
- Region zoning.
- Plateaus and buildability.
- Unified visible/build grid concept.
- Lighting, synthwave shaders and post-processing.
- Tuning/settings/debug tooling.

Optional visual work such as organic valleys is not blocking gameplay.

### Phase 2.5 — Correctness, ownership and tooling

**Scope:** Section 14.

**Exit criteria:**

- Live glint uses consistent coordinate spaces.
- Regeneration preserves every saved/live visual setting.
- Height queries are correct at map boundaries.
- Repeated regeneration/disposal does not grow geometry/material counts.
- Grid dimensions have one unambiguous meaning.
- `npm run verify` exists and passes.
- Production build is genuinely production mode.
- Authoritative docs do not claim nonexistent systems.

### Phase 3A — Minimal deterministic simulation

**Scope:**

- `tsconfig.sim.json` with no DOM library.
- Simulation import-boundary test.
- `SimConfig`, deterministic math policy and checksum.
- Commands and command queue.
- Replay log.
- Minimal `SimWorld` fixed tick.
- Minimal `UnitStore` with spawn/stop only.
- Fixed-tick accumulator integration.
- Headless tests.

**Keep it small:** no navigation, combat, production or polished renderer yet.

**Exit criteria:**

- Two independent 1,000-tick runs of the same command script have identical checksum streams.
- Replaying the recorded commands gives the same result.
- Simulation tests run under Node without browser globals or Three.js.
- First-frame delta, long-frame clamp and max-steps behaviour are tested.

### Phase 3B — Shared mutable terrain and static unit rendering

**Scope:**

- Extract pure `HeightFieldGen`.
- Introduce quantised `SimHeightField`.
- Renderer consumes the simulation heightfield.
- Introduce dirty regions.
- Implement/test a debug `Crater` deformation operation.
- Update surface vertices, normals and neon grid.
- Recalculate affected buildability.
- Add instanced static-unit rendering with interpolation plumbing.

**Exit criteria:**

- Fixed seed/config produces the same quantised initial heightfield checksum.
- Debug crater changes the same samples/checksum on repeated runs.
- Surface and neon grid remain connected after repeated overlapping craters.
- Buildability changes where expected.
- 300 static units render at 60 FPS on the development target.

### Phase 4 — Selection, navigation and movement

**Scope:**

- Picking and client-local selection.
- Input manager/control groups.
- Command emitter.
- NavGrid.
- A* behind `PathPlan`.
- Formations and local separation.
- Move/stop end-to-end.
- Local nav rebake after terrain deformation.
- Path revision/revalidation.

**Exit criteria:**

- 200 units can be box-selected and moved at 60 FPS.
- Units stay on valid terrain.
- A crater can block or alter a route and affected units recover by replanning.
- Scripted movement replay stays deterministic.

### Phase 5 — Combat sandbox and real terrain damage

**Scope:**

- Players and teams.
- Unit type stats.
- Targeting and auto-acquire.
- Projectile store/renderer.
- Swept collision.
- Heightfield LoS.
- Damage, death and cleanup.
- Weapon-linked terrain deformation.
- Health bars and effects.
- `MatchSession` and basic sandbox controls.

**Exit criteria:**

- 100-vs-100 fight reaches elimination at or near 60 FPS.
- Recorded replay reaches the identical final checksum.
- Heavy impacts visibly crater or reduce peaks.
- Terrain, grid, normals, buildability, navigation, collision and LoS agree after damage.
- No unit/projectile/instance/terrain-buffer leaks after mass death and many impacts.

### Phase 6 — Simulation hardening

**Scope:**

- Save/load complete simulation snapshots, including terrain.
- Replay viewer.
- Divergence reporting that identifies which store/terrain region differs.
- Tick-time and system-budget telemetry.
- Chrome-versus-Firefox determinism check.
- Terrain initialisation fallback decision.

**Exit criteria:**

- Save -> load -> continue matches uninterrupted checksums.
- Replay seek/restart is reliable.
- Cross-browser checksum streams match, or the initial-heightfield transfer fallback is implemented and remaining simulation streams match.

### Phase 7 — Multiplayer lockstep

**Scope:**

- WebRTC DataChannel or WebSocket relay transport.
- Match setup/terrain agreement.
- Input delay negotiation.
- Lockstep scheduler.
- Stall/catch-up behaviour.
- Checksum exchange and desync reporting.
- Two-player sandbox.

**Exit criteria:**

- LAN 100-vs-100 match completes without desync.
- Terrain deformation remains identical between peers.
- Match remains playable under 200 ms simulated latency.
- A disconnect/desync produces a useful diagnostic rather than silent divergence.

### Phase 8 — Economy, buildings and production

**Scope:**

- Four-resource model.
- Resource placement/generation.
- Building placement on mutable terrain.
- Foundation/destruction rules.
- Construction and builders.
- Factory production queues.
- Economy commands and UI.

**Exit criteria:**

- A scripted build order replays deterministically.
- Multiplayer smoke test remains clean.
- Terrain damage cannot silently corrupt building or nav state.

### Phase 9 — AI, modes and polish

**Scope:**

- Skirmish AI issuing commands.
- Menus/lobby flow.
- RTS camera refinement.
- Minimap and strategic information.
- Audio.
- Unit/building art pass.
- Additional game modes and balance.

**Exit criteria:**

- AI can play a complete match.
- Main flow works from launch to match result.
- Performance and determinism gates remain green.

---

## 16. Verification and Performance Gates

### Every code change

- Type-check the relevant project.
- Run focused tests.
- Run production build when bundling/render code changed.
- Avoid claiming a visual fix from numerical simulation alone; verify in the browser.

### Every phase boundary

- `npm run verify` passes.
- Determinism suite passes.
- No new simulation boundary violation.
- `CLAUDE.md`, this plan and `README.md` are consistent.
- Record benchmark hardware/browser and scenario.

### Core automated tests

Minimum test areas:

- RNG known sequences and state restoration.
- Command ordering and stale handles.
- Replay equivalence.
- Heightfield boundaries and interpolation.
- Terrain generation checksum.
- Crater centre, edge, outside radius and clipping at map boundaries.
- Overlapping crater ordering.
- Terrain dirty-region merging.
- Local buildability/nav updates.
- UnitStore capacity/reuse/generation handles.
- Movement bounds and terrain revision handling.
- Projectile swept hits and terrain hits.
- Combat cadence and team hostility.
- Save/load continuation.

### Performance scenarios

Track at least:

1. Terrain only, normal camera movement.
2. 300 static units.
3. 200 moving units.
4. 100-vs-100 combat.
5. Many simultaneous projectiles.
6. Repeated large crater deformation.
7. Mass death and cleanup.

Measure:

- Render FPS/frame time.
- Simulation tick time by system.
- Draw calls and triangles.
- Unit/projectile pool usage.
- Number/area of dirty terrain updates.
- Pathfinding jobs and replans.
- Heap growth across repeated scenarios.

---

## 17. Known Risks and Mitigations

### FastNoiseLite cross-browser generation

**Risk:** Same seed may not yield bit-identical floats on every browser engine.  
**Mitigation:** Quantise initial output; test in Phase 6; transmit initial heightfield from host if required.

### Floating-point simulation drift

**Risk:** Unit movement and repeated terrain changes can diverge.  
**Mitigation:** Determinism tests from Phase 3A; fixed-point/integer terrain; deterministic approximations; cross-browser test before multiplayer.

### Terrain resolution

**Risk:** 64-unit samples make small craters blocky.  
**Mitigation:** Deform only larger impacts initially; visual effects for small hits; separate height sample spacing from build cell size so resolution can increase later.

### Pathfinding after deformation

**Risk:** Frequent craters cause excessive rebakes/repaths.  
**Mitigation:** Dirty-cell rebake, revisioned paths, bounded job queue and only replan invalid paths.

### Shader fragility

**Risk:** `onBeforeCompile` injection depends on Three.js chunk names and coordinate assumptions.  
**Mitigation:** Narrow changes, explicit shader compile checks, debug modes and a future decision to move to a dedicated ShaderMaterial only if maintenance cost justifies it.

### Too much visual tuning before gameplay

**Risk:** The project continues polishing terrain indefinitely.  
**Mitigation:** Phase 2.5 fixes correctness only. Optional valley/water polish waits until after the combat sandbox unless it blocks gameplay.

### Phase size and hobby-project momentum

**Risk:** A large all-at-once Phase 3 stalls.  
**Mitigation:** Keep Phase 3A minimal and headless; Phase 3B proves terrain/render boundary separately; each session ends with one tested outcome and one next task.

### OneDrive file watching/dependency state

**Risk:** Native file events or hydrated dependencies become unreliable.  
**Mitigation:** Keep polling watcher; restart dev server when a change appears inert; use non-watch test runs for reliable verification; commit the lockfile.

---

## 18. Guidance for Future AI-Assisted Coding Sessions

### Session-start checklist

An AI coding session should:

1. Read this file fully.
2. Read `CLAUDE.md` fully.
3. Check `README.md`, `package.json`, repository status and recent commits.
4. Inspect the actual files involved; do not rely only on documentation.
5. Identify the current phase and one smallest deliverable.
6. State assumptions before changing a locked contract.
7. Preserve unrelated user changes in a dirty worktree.

### Implementation rules

- Prefer a small tested vertical slice over creating every planned folder as an empty stub.
- Do not mix Three.js or DOM types into `src/sim/`.
- Do not let render objects own game state.
- Do not add wall-clock time to simulation logic.
- Do not use `Math.random()` in simulation.
- Do not bypass commands for user/network gameplay actions.
- Do not optimise without a measured problem, except for architectural scale requirements already locked here.
- Do not port the old object-based unit implementation wholesale.
- Do not regenerate the whole procedural map for a crater.
- Do not maintain a second terrain truth for grid/nav/render.
- Do not retune the glint until its coordinate-space bug is fixed.
- Do not report numerical simulator success as proof of an in-browser shader result.

### Change checklist

For each feature:

- What state is authoritative?
- Is it simulation state or local presentation state?
- How does it enter the simulation?
- Is ordering deterministic?
- Is randomness from a named stream?
- Is it included in checksum/replay/save if authoritative?
- What is its cleanup path?
- What boundary/edge cases are tested?
- What happens when terrain changes underneath it?

### Completion standard

A task is not complete because it compiles. It is complete when:

- The intended behaviour is implemented.
- Relevant tests pass.
- Boundary and cleanup behaviour are covered in proportion to risk.
- Determinism remains green for simulation work.
- Browser behaviour is checked for visual work.
- Documentation is updated only where the truth changed.

---

## 19. Old Code: What May Be Reused

From historical commit `3b6eeea`:

| Old concept | Treatment |
|---|---|
| Input key state and control-group concepts | Port carefully into engine input |
| `GameInterface` seam | Use as inspiration for input actions/MatchSession boundary |
| Unit stats record shape | Recreate with numeric/plain types |
| Formation row/column maths | Reuse after deterministic review and rescaling |
| Combat cadence concept | Recreate using ticks |
| `Unit extends Object3D` | Reject |
| Per-unit meshes/health bars/selection objects | Reject for high unit count |
| Wall-clock attack timing | Reject |
| Scene-Raycaster line of sight | Reject |
| Old projectile objects | Reject |
| Simulation `Math.random()` scrap generation | Reject |

The historical implementation proves some desired interactions, but it is not an architectural foundation.

---

## 20. Final Direction

LowDrag RTS should proceed as:

> A deterministic, multiplayer-ready RTS simulation driving a separate Three.js presentation layer, using one mutable connected heightfield for terrain rendering, traversal, building, line of sight and destructible-terrain gameplay.

The terrain prototype is worth keeping. The gameplay layer should be new. Terrain destruction should be designed into the authoritative heightfield before combat and pathfinding become deeply established.

The next coding task is **Phase 2.5, item 14.1: fix the terrain shader's coordinate-space mismatch and verify the live glint before changing any tuning constants**.
