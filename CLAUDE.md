# Project: LowDrag RTS

## What this is
A voxel-based real-time strategy game inspired by Total Annihilation. Built with TypeScript, Three.js and Node.js, rendered in the browser via Webpack. Features destructible terrain, physics-based combat, line of sight, day/night cycle and a three-resource economy (Skirulum, Vlux, Fredalite). Agile hobby project — worked on in sessions when time allows.

## Target
No hard deadline. Progress when time allows. Next milestone: clean TypeScript compilation, then basic resource system.

## Current Status
🔴 Does not compile cleanly — TypeScript errors across 5 files (see Known Bugs below).
Core engine, terrain, unit movement, combat, projectiles, health bars, day/night cycle and command visualization are all implemented and working. Resource system not yet implemented.

## Architecture Notes
- **Stack:** TypeScript, Three.js (3D rendering), Node.js, Webpack
- **Entry point:** `src/index.ts` — main Game class
- **Key directories:**
  - `src/engine/units/` — Unit.ts, UnitManager.ts
  - `src/engine/ui/` — GameUI.ts, HelpDialog.ts
  - `src/engine/combat/` — Projectile.ts
- **Map:** 64x64 grid tiles, each tile 25x25 voxels, supports 6 players
- **Unit supply cap:** 200 total
- **Resources:** Skirulum (primary), Vlux (energy), Fredalite (rare), Scrap (secondary from wreckage)
- **Day/night cycle** affects Vlux collection rate — already implemented visually

## Do Not Touch
- Working terrain generation system
- Day/night cycle implementation
- Projectile physics and LoS system — recently fixed and working
- Combat system — units stay in place when attacking, LoS checks working

## Active Tasks
- [ ] Fix TypeScript errors in Projectile.ts (~1h)
- [ ] Fix TypeScript errors in GameUI.ts (~1h)
- [ ] Fix TypeScript errors in HelpDialog.ts (~0.5h)
- [ ] Fix TypeScript errors in Unit.ts (~1h)
- [ ] Fix TypeScript errors in UnitManager.ts (~1h)
- [ ] Commit clean compiling baseline once all errors fixed
- [ ] Implement Scrap resource collection UI (~3h)
- [ ] Implement Skirulum harvesting system (~5h)
- [ ] Implement Vlux solar collection system (~4h)
- [ ] Implement Fredalite collection buildings (~4h)
- [ ] Add resource UI (numerical display, bars, rates) (~3h)

## Known Bugs

### Projectile.ts
- Property `trail` needs initialization in constructor
- Property `trailPositions` needs initialization in constructor

### GameUI.ts
- Type mismatch between HTMLStyleElement and string
- Incorrect Node type handling in DOM manipulation
- TextContent property access on string type

### HelpDialog.ts
- Property `dialog` needs initialization in constructor

### Unit.ts
- Constructor argument mismatches
- Missing `showCommand` property on CommandVisualizer
- Material property access issues on Object3D
- Type safety issue with `Unit | null` in combat handling

### UnitManager.ts
- Constructor argument count mismatch
- Type issues in arithmetic operations with selection coordinates

## Planned Features (from gameplan.MD)

### Phase 1 — Stabilise
- Fix all TypeScript compilation errors
- Commit clean baseline

### Phase 2 — Playable core
- Scrap resource collection (wreckage system already exists)
- Basic resource UI

### Phase 3 — Full resource system
- Skirulum harvesting via vehicles and foundries
- Vlux solar concentrators (day/night affects rate)
- Fredalite collection buildings (finite, 10-tile spacing)

### Phase 4 — Buildings and production
- Building placement (free placement like Total Annihilation)
- Factory with unit queue (up to 30)
- Builder units, multiple builders speed construction
- Tech tree with Advanced Technology Center

### Phase 5 — AI and polish
- Pathfinding improvements
- Basic enemy AI
- Formation movement
- Minimap
- Win/lose conditions

## Resource Design Reference
- **Skirulum** — blue/purple voxel formations, harvested by vehicles, processed in foundries
- **Vlux** — energy, solar concentrators on elevated nodes, stored in batteries
- **Fredalite** — rare crystals, special collector buildings, finite, depletes over time
- **Scrap** — from wreckage, collected by any unit moving over it, converts 10:1 to Skirulum/Vlux

## Session Log
| Date | What was done | Next steps |
|------|--------------|------------|
| Early 2025 | Core engine, combat, projectile fixes, LoS system | Fix remaining TypeScript errors |
| — | Project restarted | Begin with TypeScript error fixes in Projectile.ts |

---
*Update this file at the end of every coding session.*
*Claude Code reads this automatically at session start for full context.*