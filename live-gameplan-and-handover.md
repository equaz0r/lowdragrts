# Live Gameplan and Handover - March 22, 2025

## Current Development Status

### Active Branch and Features
- Branch: `terrain-rebuild`
- Current focus: Lighting system improvements and atmospheric effects
- Latest major changes: Sun shader improvements and shape fixes

### Current Implementation Details
- Grid Size: 32x32
- Cell Size: 100 units
- Terrain Height Scale: 200 units
- Noise Texture Size: 4096x4096
- Day Length: 3600 seconds (1 hour)

### Working Features
- ✅ Sun sphere and halo rendering correctly
- ✅ Sun orbit near horizon
- ✅ Terrain generation
- ✅ Basic lighting effects
- ✅ Camera controls

## Development Environment Setup

### Prerequisites
1. Node.js and npm installed
2. Cursor IDE installed
3. Git installed and configured

### Setup Commands
```bash
# Clone the repository
git clone https://github.com/yourusername/lowdragrts.git
cd lowdragrts

# Check available branches
git branch -a

# Switch to the terrain-rebuild branch
git checkout terrain-rebuild

# Pull the latest changes
git pull origin terrain-rebuild

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Useful Status Commands
```bash
# Check working directory status
git status

# View recent commits (last 5)
git log --oneline -n 5
```

## Current Backlog

### 1. Atmospheric Effects (Priority)
1. Heat Distortion
   - Implement noise-based vertex displacement in fragment shader
   - Add time-based animation for dynamic effect
   - Vary distortion intensity with sun height
   - Focus effect near horizon for realistic heat waves
   - Consider performance impact and optimization strategies

2. Atmospheric Scattering
   - Implement realistic Rayleigh scattering simulation
   - Add wavelength-dependent color shifts
   - Enhance sunset/sunrise color transitions
   - Consider adding volumetric lighting effects
   - Optimize for performance vs. quality balance

3. Dynamic Air Density
   - Add density-based distortion near horizon
   - Implement height-based atmospheric thickness
   - Consider adding dust/haze effects
   - Possible weather system integration
   - Optimize with distance-based detail reduction

### 2. Terrain System Improvements
1. Terrain Orientation
   - Fix terrain appearing as thin strip/wall
   - Correct height variations in 3D space
   - Fix relationship between terrain geometry and grid coordinates
   - Ensure terrain covers entire grid area (-32 to +32)
   - Consider using BufferGeometry with custom attributes

2. Terrain Detail and Colors
   - Adjust noise octaves for better variation
   - Fine-tune height scaling
   - Improve normal calculation for better lighting
   - Implement multi-color gradient system:
     * Base: Red (0xff2200)
     * Orange: Red-orange (0xff6600)
     * Yellow: Orange-yellow (0xffaa00)
     * Purple: Bright purple (0xff33ff)
     * Cyan: Cyan (0x00ffff)
     * Blue: Dark blue (0x0066ff)

3. Performance Optimization
   - Fix chunks requiring regeneration to be visible
   - Synchronize mesh updates properly
   - Verify UV coordinate generation
   - Monitor frame rate with current implementation
   - Add debug visualization for chunk boundaries

### 3. Visual Refinements
1. Sun Appearance
   - Edge sharpness (currently 0.92-0.96)
   - Base brightness (currently 1.4x)
   - Radial gradient (currently 1.0-1.1)

2. Halo Effect
   - Size ratio relative to sun
   - Opacity and fade characteristics
   - Color intensity at different heights

### 4. Technical Infrastructure
1. Shader System
   - Create new shader system
   - Implement metallic reflection
   - Add Fresnel effect
   - Set up day/night cycle

2. UI and Controls
   - Add seed management UI
   - Implement time controls
   - Add debug visualization
   - Create save/load system

## Current Adjustable Parameters

### Sun and Sky Parameters
1. Sun Parameters
   - `sunGeometry.radius`: 2400 (range: 1000-5000)
   - `sunMaterial.brightness`: 1.4 (range: 0.5-2.0)
   - `sunMaterial.edgeSharpness`: smoothstep(0.92, 0.96, dist)

2. Halo Parameters
   - `haloGeometry.size`: 28800 (range: 9600-40000)
   - `haloMaterial.alpha`: pow(alpha, 1.5) * 0.6
   - `haloMaterial.heightFactor`: smoothstep(0.25, 0.7, sunHeight)

3. Sky Parameters
   - `skyMaterial.offset`: 33 (range: 20-50)
   - `skyMaterial.exponent`: 0.6 (range: 0.3-1.0)

### Terrain Parameters
1. Grid System
   - `glowIntensity`: 0.4 (range: 0.0-1.0)
   - `groundGlowIntensity`: 0.85 (range: 0.0-1.0)
   - `sunIntensity`: 12.0 (range: 5.0-20.0)

2. Color Parameters
   - `edgeColorGround`: 0xff6600 (orange)
   - `edgeColorHeight`: 0x88ff22 (neon green)

### Lighting Parameters
1. Ambient Light
   - `ambientLight.intensity`: Base: 0.1, Range: 0.05-0.15

2. Directional (Sun) Light
   - `sunLight.intensity`: Base: 0.3, Range: 0.0-0.3

### Movement Parameters
1. Sun Movement
   - `smoothSpeed`: 0.15 (range: 0.05-0.3)
   - `sunHeightRange`: Min: 0.3, Max: 0.65

## Long-term Gameplan

### Resource Systems
1. Primary Resources
   - Skirulum (construction material)
   - Vlux (energy resource)
   - Fredalite (rare crystal)
   - Scrap (secondary resource)

### Scale and World Design
- 64x64 grid tiles
- Each tile: 25x25 voxels
- Supports 6 players
- Starting zones with basic resources
- Strategic central Fredalite locations

### Combat System
1. Weapons and Combat
   - Physics-based projectiles
   - Line of sight requirements
   - Terrain destruction mechanics
   - Artillery units with indirect fire
   - Special abilities for advanced units

2. Unit Types
   - Infantry (basic robots)
   - Ground Vehicles
   - Flying Units
   - Heavy Mechs
   - Static Defenses

### Construction and Base Building
- Free placement system
- Physical construction by builder units
- Multiple builders speed up construction
- Factory queues up to 30 units
- Interconnected defense systems

### UI and Control Systems
1. Resource Interface
   - Numerical and bar displays
   - Low resource warnings
   - Resource rate indicators
   - Game timer display

2. Unit Control
   - Traditional RTS drag-box selection
   - Control groups
   - Basic formation system
   - Waypoint system
   - Shift-click command queuing

3. Combat Feedback
   - Unit health bars
   - Damage numbers
   - Visual damage states
   - Map alert system

4. Strategic View
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