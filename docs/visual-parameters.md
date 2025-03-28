# Visual Parameters Documentation

This document details all adjustable visual parameters in the game engine, their effects, and locations.

## Camera Settings
Location: `src/engine/core/GameStateMachine.ts`

| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `camera.position` | Initial camera position (x, y, z) | `(2000, 1500, 2000)` |
| `camera.far` | Far clipping plane distance | `100000` |
| `camera.fov` | Field of view in degrees | `75` |

## Lighting System
Location: `src/engine/terrain/LightingSystem.ts`

### Sky Colors
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `topColor` | Upper sky color | `0x001133` (Deep blue) |
| `middleColor` | Middle sky color | `0x330066` (Deep purple) |
| `bottomColor` | Lower sky color | `0x000022` (Very dark blue) |
| `skyUniforms.offset` | Sky gradient offset | `400` |
| `skyUniforms.exponent` | Sky gradient power | `0.6` |

### Sun Parameters
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `sunGeometry` | Sun sphere size | `600` units |
| `sunMaterial.opacity` | Sun opacity | `0.9` |
| `sunLowColor` | Sun color at horizon | `0xff4422` (Red-orange) |
| `sunHighColor` | Sun color at peak | `0xffffaa` (Yellow-white) |
| `distance` | Sun orbit radius | `8000` units |
| `maxHeight` | Maximum sun height | `0.65` |
| `minHeight` | Minimum sun height | `0.3` |

### Halo Effect
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `haloGeometry` | Halo sphere size | `4000` units |
| `haloIntensity` | Halo glow strength | `0.3` |
| `haloBlending` | Blend mode | `THREE.AdditiveBlending` |

### Lighting Intensities
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `ambientLight.intensity` | Base ambient light | `0.2` |
| `sunLight.intensity` | Direct sunlight strength | `1.0` |
| `sunIntensity` | Dynamic sun intensity range | `0.6 - 1.0` |
| `ambientIntensity` | Dynamic ambient range | `0.1 - 0.3` |

## Terrain Generation
Location: `src/engine/terrain/TerrainGenerator.ts`

### Terrain Geometry
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `size` | Terrain plane size | `4000` units |
| `segments` | Grid resolution | `200` |
| `scale1` | Broad feature scale | `0.0015` |
| `scale2` | Medium feature scale | `0.005` |
| `scale3` | Detail feature scale | `0.02` |

### Height Generation
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `heightMultiplier1` | Large feature height | `200` units |
| `heightMultiplier2` | Medium feature height | `100` units |
| `heightMultiplier3` | Small feature height | `50` units |

### Terrain Material
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `baseColor` | Base terrain color | `0x444444` (Dark gray) |
| `glowColor` | Edge glow color | `0x666666` (Medium gray) |
| `heightColor` | Height-based color | `0x888888` (Light gray) |
| `heatNoiseScale` | Heat distortion scale | `0.2` |
| `heatNoiseSpeed` | Heat animation speed | `0.1` |
| `heatIntensity` | Heat effect strength | `0.1` |

## Grid System
Location: `src/engine/terrain/GridSystem.ts`

| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `totalSize` | Grid size | `4000` units |
| `divisions` | Grid line count | `100` |
| `mainColor` | Primary grid color | `0x444444` |
| `secondaryColor` | Secondary grid color | `0x888888` |

## Shader Parameters
Location: `src/engine/shaders/terrain.frag`

### Grid and Edge Effects
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `faceColor` | Base color of terrain faces | `0x020205` |
| `edgeColorGround` | Color of grid lines at ground level | `0xff6600` |
| `edgeColorHeight` | Color of grid lines at higher elevations | `0x88ff22` |
| `coreColorGround` | Color of grid intersections at ground level | `0xfff7b1` |
| `coreColorHeight` | Color of grid intersections at higher elevations | `0xe8ffd8` |
| `glowIntensity` | Overall intensity of the glow effect | `0.4` |
| `groundGlowIntensity` | Intensity of glow effect at ground level | `0.85` |
| `cellSize` | Size of each grid cell | `32` |

### Lighting and Effects
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `highlightColor` | Color of specular highlights | `0xff6600` |
| `sheenColor` | Color of metallic sheen effect | `0xff00ff` |
| `sheenIntensity` | Intensity of metallic sheen effect | `0.8` |
| `glowFalloff` | Rate at which glow effect fades with distance | `0.0001` |
| `lightColor` | Color of the main light source | `0xffffff` |

### Heat Distortion
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `heatNoiseScale` | Scale of heat distortion noise pattern | `0.05` |
| `heatNoiseSpeed` | Speed of heat distortion animation | `0.2` |
| `heatIntensity` | Overall strength of heat distortion | `0.7` |
| `heatHeightFactor` | Influence of height on heat distortion | `0.5` |

### Shadow Parameters
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `shadowSoftness` | Softness of shadow edges | `0.3` |
| `shadowIntensity` | Overall intensity of shadows | `0.95` |

## Sun and Lighting
- Sun Direction: Vector3(-1, 0.3, 0).normalize() (default)
- Sun Color: Color(1.0, 0.98, 0.9) (warm white)
- Sun Intensity: 1.0 (base value)
- Sun Height: 0.3 (y-component of normalized direction)

## Reflections
### Material Properties
Location: `src/engine/terrain/TerrainGenerator.ts`

| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `metalness` | Base material metalness | `0.6` |
| `roughness` | Base material roughness | `0.4` |
| `envMapIntensity` | Environment map reflection strength | `0.8` |

### Shader Parameters
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `reflectionParams` | Vector4 controlling reflection behavior | `(0.7, 0.2, 2.0, 0.6)` |
| `sunIntensity` | Overall sun reflection strength | `0.8` |

### Reflection Factor Weights
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `viewFactor` | Weight of view-dependent reflection | `2.5` |
| `sunFactor` | Weight of sun-dependent reflection | `2.0` |
| `positionFactor` | Weight of position-based falloff | `0.8` |
| `panelFactor` | Weight of panel-based variation | `0.2` |
| `grazingFactor` | Weight of grazing angle effect | `1.5` |

### Reflection Powers
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `sunFactorPower` | Power applied to sun alignment | `0.4` |
| `viewFactorPower` | Power applied to view alignment | `0.8` |
| `heightFactorPower` | Power applied to height-based effect | `0.2` |
| `grazingFactorPower` | Power applied to grazing angle | `0.6` |

### Reflection Thresholds
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `minReflection` | Minimum reflection threshold | `0.2` |
| `reflectionBlend` | Reflection color blend strength | `2.0` |

### Position-based Parameters
| Parameter | Description | Current Value |
|-----------|-------------|---------------|
| `westFalloffStart` | Distance from west edge to start falloff | `-2000` |
| `westFalloffLength` | Length over which western falloff occurs | `4000` |

## Notes on Reflection System
- Reflections are strongest when viewing surfaces that face the sun
- Western-facing surfaces have enhanced reflection strength
- Flatter surfaces show stronger reflections than steep surfaces
- Panel borders have reduced reflection intensity
- All reflection parameters can be adjusted in real-time through the shader uniforms

## Grid System
- Grid Size: 4000 units
- Grid Divisions: 100 (doubled for higher resolution)
- Segment Size: 40 units
- Panel Border Width: 0.95 (thin borders)
- Panel Variation: 0.1 (subtle variation)

## Terrain Generation
- Height Scale: 800 units
- Noise Scale: 0.001
- Noise Octaves: 8
- Persistence: 0.65
- Lacunarity: 1.6

## Colors
- Base Color: Color(0x000033) (dark blue)
- Peak Color: Color(0x3366ff) (bright blue)
- Low Edge Color: Color(0xff6600) (orange)
- High Edge Color: Color(0x00ff00) (green)

## Notes on Adjusting Parameters
- Color values are in hexadecimal format
- Distance units are consistent across the engine
- Intensity values typically range from 0.0 to 1.0
- Scale values affect the frequency of features (lower = larger features)
- All parameters can be adjusted at runtime through the respective class instances 