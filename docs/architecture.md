# Engine Architecture

## Overview
The engine is built using Three.js as its core rendering framework, with a custom architecture designed for real-time strategy games. The system is modular and component-based, allowing for easy extension and modification.

## Core Systems

### 1. Terrain System
- **TerrainGenerator**: Handles terrain mesh creation and geometry
  - Uses SimplexNoise for height generation
  - Implements custom shaders for reflections and lighting
  - Supports dynamic LOD and chunking
- **GridSystem**: Manages the game grid and coordinate system
  - Handles grid-based positioning and snapping
  - Manages grid visualization and interaction
  - Supports different grid types and sizes

### 2. Lighting System
- **LightingSystem**: Controls all lighting aspects
  - Manages sun position and movement
  - Handles dynamic shadows
  - Controls ambient and directional lighting
  - Updates reflection parameters in real-time

### 3. Shader System
- Custom shaders for terrain rendering
- Reflection and lighting calculations
- Panel-based grid visualization
- Height-based color interpolation

### 4. Camera System
- **CameraController**: Manages camera movement and interaction
  - Supports different camera modes
  - Handles input and controls
  - Manages camera constraints and boundaries

## Technical Implementation

### Shader Usage
- Custom vertex and fragment shaders for terrain
- Reflection calculations in fragment shader
- Panel effect implementation
- Height-based color blending

### Performance Considerations
- LOD system for terrain
- Efficient grid rendering
- Optimized shader calculations
- Memory management for large terrains

### Dependencies
- Three.js for 3D rendering
- Custom math utilities
- Noise generation libraries
- Input handling systems

## Game World Structure

### Coordinate System
- Grid-based coordinate system
- World space vs. grid space conversion
- Cardinal direction mapping
- Height-based positioning

### Terrain Features
- Height-based terrain generation
- Panel-based grid system
- Dynamic color interpolation
- Reflection and lighting effects

### Interaction Systems
- Grid-based placement
- Height-based constraints
- Camera controls
- Input handling

## Future Considerations
- Dynamic terrain modification
- Advanced lighting features
- Improved performance optimizations
- Enhanced shader effects
- Better memory management
- Multi-threading support 