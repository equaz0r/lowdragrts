# Current Adjustable Effects Parameters

This document lists all adjustable parameters that affect visual effects in the game, including their current values, effects, and adjustment ranges.

## Sun and Sky Parameters

### Sun Parameters

#### `sunGeometry.radius`
- **Code Location**: `LightingSystem.ts`
- **Current Value**: 2400
- **Description**: Controls the size of the sun sphere in world units
- **Effect**: Larger values make the sun appear bigger in the sky
- **Range**: 1000-5000 (suggested)
- **Notes**: Very large values might affect performance due to pixel fill rate

#### `sunMaterial.brightness`
- **Code Location**: `LightingSystem.ts` (sun shader)
- **Current Value**: 1.4
- **Description**: Base brightness multiplier for the sun's surface
- **Effect**: Higher values make the sun appear brighter and more intense
- **Range**: 0.5-2.0
- **Notes**: Values above 1.5 might cause bloom/glare effects

#### `sunMaterial.edgeSharpness`
- **Code Location**: `LightingSystem.ts` (sun shader)
- **Current Value**: smoothstep(0.92, 0.96, dist)
- **Description**: Controls the sharpness of the sun's edge
- **Effect**: Tighter range makes edges sharper, wider range makes them softer
- **Range**: First value: 0.85-0.95, Second value: 0.90-0.98
- **Notes**: Values too close together might cause aliasing

### Halo Parameters

#### `haloGeometry.size`
- **Code Location**: `LightingSystem.ts`
- **Current Value**: 28800 (3x sun size)
- **Description**: Size of the sun's halo effect
- **Effect**: Larger values create a bigger glow around the sun
- **Range**: 9600-40000
- **Notes**: Should generally be 3-4x larger than sun radius

#### `haloMaterial.alpha`
- **Code Location**: `LightingSystem.ts` (halo shader)
- **Current Value**: pow(alpha, 1.5) * 0.6
- **Description**: Controls halo opacity and fade
- **Effect**: Higher power (1.5) makes fade more gradual, multiplier (0.6) affects overall opacity
- **Range**: Power: 1.0-2.0, Multiplier: 0.2-1.0
- **Notes**: Lower power values create sharper halos

#### `haloMaterial.heightFactor`
- **Code Location**: `LightingSystem.ts` (halo shader)
- **Current Value**: smoothstep(0.25, 0.7, sunHeight)
- **Description**: Controls how halo intensity changes with sun height
- **Effect**: Adjusts halo visibility based on sun position
- **Range**: First value: 0.1-0.3, Second value: 0.6-0.8
- **Notes**: Affects sunset/sunrise appearance

### Sky Parameters

#### `skyMaterial.offset`
- **Code Location**: `LightingSystem.ts`
- **Current Value**: 33
- **Description**: Offset for sky gradient calculation
- **Effect**: Affects the position and spread of the sky gradient
- **Range**: 20-50
- **Notes**: Higher values push gradient higher in sky

#### `skyMaterial.exponent`
- **Code Location**: `LightingSystem.ts`
- **Current Value**: 0.6
- **Description**: Controls sky gradient power/contrast
- **Effect**: Higher values make gradient more pronounced
- **Range**: 0.3-1.0
- **Notes**: Affects overall sky appearance dramatically

## Terrain Parameters

### Grid System

#### `glowIntensity`
- **Code Location**: `TerrainGenerator.ts`
- **Current Value**: 0.4
- **Description**: Base intensity for grid line glow
- **Effect**: Controls how bright the grid lines appear
- **Range**: 0.0-1.0
- **Notes**: Higher values may cause bloom in post-processing

#### `groundGlowIntensity`
- **Code Location**: `TerrainGenerator.ts`
- **Current Value**: 0.85
- **Description**: Intensity of ground-level grid glow
- **Effect**: Controls ground grid line brightness
- **Range**: 0.0-1.0
- **Notes**: Affects terrain visibility at night

#### `sunIntensity`
- **Code Location**: `TerrainGenerator.ts`
- **Current Value**: 12.0
- **Description**: Intensity of sun lighting on terrain
- **Effect**: Controls overall terrain brightness from sun
- **Range**: 5.0-20.0
- **Notes**: Affects shadow contrast

### Color Parameters

#### `edgeColorGround`
- **Code Location**: `TerrainGenerator.ts`
- **Current Value**: new THREE.Color(0xff6600)
- **Description**: Color of grid lines at ground level
- **Effect**: Changes the color of base terrain grid
- **Range**: Any valid hex color
- **Notes**: Currently orange (0xff6600)

#### `edgeColorHeight`
- **Code Location**: `TerrainGenerator.ts`
- **Current Value**: new THREE.Color(0x88ff22)
- **Description**: Color of grid lines at height
- **Effect**: Changes the color of elevated terrain grid
- **Range**: Any valid hex color
- **Notes**: Currently neon green (0x88ff22)

## Lighting Parameters

### Ambient Light

#### `ambientLight.intensity`
- **Code Location**: `LightingSystem.ts`
- **Current Value**: Base: 0.1, Range: 0.05-0.15
- **Description**: Base ambient light level
- **Effect**: Controls minimum scene brightness
- **Range**: 0.05-0.2
- **Notes**: Calculated as: Math.max(0.05, 0.1 * (normalizedSunHeight + 0.5))

### Directional (Sun) Light

#### `sunLight.intensity`
- **Code Location**: `LightingSystem.ts`
- **Current Value**: Base: 0.3, Range: 0.0-0.3
- **Description**: Intensity of directional sunlight
- **Effect**: Controls shadow strength and overall lighting
- **Range**: 0.0-0.5
- **Notes**: Calculated as: Math.max(0, 0.3 * normalizedSunHeight)

## Movement Parameters

### Sun Movement

#### `smoothSpeed`
- **Code Location**: `LightingSystem.ts`
- **Current Value**: 0.15
- **Description**: Speed of sun height interpolation
- **Effect**: Controls how smoothly sun moves to new height
- **Range**: 0.05-0.3
- **Notes**: Lower values = smoother but slower movement

#### `sunHeightRange`
- **Code Location**: `LightingSystem.ts`
- **Current Value**: Min: 0.3, Max: 0.65
- **Description**: Minimum and maximum sun height values
- **Effect**: Controls sun's vertical range of movement
- **Range**: Min: 0.2-0.4, Max: 0.6-0.8
- **Notes**: Affects day/night cycle appearance 