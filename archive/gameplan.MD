# LowDrag RTS - Game Design Document

## Overview
A voxel-based real-time strategy game inspired by Total Annihilation, featuring destructible terrain, physics-based combat, and a three-resource economy system.

## Resource Systems

### Primary Resources
1. **Skirulum**
   - Primary construction material
   - Appears as blue/purple voxel formations with glow effects
   - Harvested by vehicles and processed in foundries
   - Physically transported and stockpiled
   - Visible stockpile growth with logarithmic scale UI

2. **Vlux**
   - Energy resource
   - Collected by Solar Concentrators built on specific nodes
   - Day/night cycle affects collection rate
   - Can be stored in battery structures
   - Visual beam effects and heat distortion
   - Nodes on elevated positions/rocky outcrops

3. **Fredalite**
   - Rare crystal resource
   - Surface-level formations
   - Collected by special buildings with 3-4 tile radius
   - Collectors pulse with green luminosity
   - Finite resource, eventually depletes
   - 10-tile minimum spacing between collectors
   - Required for advanced units/research

4. **Scrap** (Secondary Resource)
   - Obtained from unit/building wreckage
   - Collected by any unit moving over it
   - Processed into Skirulum plates and Vlux (10:1 ratio)
   - Instant collection to resource pool

## Scale and World Design

### Map Specifications
- 64x64 grid tiles
- Each tile is 25x25 voxels
- Supports 6 players
- Starting zones with basic resources
- Strategic central Fredalite locations

### Unit Scales
- Infantry: 6x3x3 voxels
- Tanks: 10x6x6 voxels
- Heavy Units: Up to 20x20x20 voxels

### Building Scales
- Modular sizes in 10-voxel increments
- Ranges from 10x10x10 to 50x50x50
- Variable dimensions (e.g., 10x10x30 for tall structures)

### Terrain Features
- Multiple biomes (forest, mountains, volcanic, alien desert)
- Destructible and indestructible terrain
- Natural chokepoints and barriers
- Rivers and cliffs
- Strategic resource placement

## Combat System

### Weapons and Combat
- Physics-based projectiles
- Line of sight requirements
- Terrain destruction mechanics
- Artillery units with indirect fire
- Special abilities for advanced units
- Superweapon tech choices (mutually exclusive)

### Unit Types
- Infantry (basic robots)
- Ground Vehicles
- Flying Units
- Heavy Mechs
- Static Defenses (turrets, walls, gates)

### Unit Management
- 200 supply cap total
- Variable supply costs:
  * Basic units: 1-2 supply
  * Medium units: 2-5 supply
  * Flying units: 5-10 supply
  * Advanced units: 10+ supply

## Construction and Base Building

### Building System
- Free placement system (like Total Annihilation)
- Physical construction by builder units
- Multiple builders speed up construction
- Factory queues up to 30 units
- Interconnected defense systems

### Tech Progression
- Traditional tech tree system
- Advanced Technology Center for high-tier units
- Multi-resource requirements for advanced structures
- 10-minute timeline to mid-game
- 15-20 minutes to late-game/advanced units

## UI and Control Systems

### Resource Interface
- Numerical and bar displays
- Low resource warnings
- Resource rate indicators (harvest/consumption)
- Game timer display

### Unit Control
- Traditional RTS drag-box selection
- Control groups
- Basic formation system
- Waypoint system (up to 5 queued commands)
- Shift-click command queuing

### Combat Feedback
- Unit health bars
- Damage numbers
- Visual damage states (sparks, scorch marks, lost voxels)
- Map alert system

### Strategic View
- Minimap system
- Strategic zoom levels
- Resource node markers
- Building/unit indicators
- Movement markers
- Alert icons and text

## Implementation Priority

1. Basic voxel engine
   - Terrain system
   - Modification capabilities
   - Chunking system

2. Unit movement and physics system

3. Resource system and collection

4. Building placement and construction

5. Combat system and projectiles

6. UI and feedback systems

## Technical Requirements
- Node.js backend
- Three.js for 3D rendering
- TypeScript for type safety
- Webpack for bundling
- Physics-based gameplay systems 