# Source Code Documentation

This document provides an overview of the project's source code structure and the purpose of each component.

## Project Structure

```
src/
├── engine/         # Core game engine components
├── ui/            # User interface components
├── types/         # TypeScript type definitions
├── archive/       # Archived/legacy code
├── index.ts       # Main application entry point
└── main.ts        # Application initialization
```

## Core Components

### Engine (`src/engine/`)

- `Game.ts` - Main game engine class that orchestrates all game systems
- **Config/**
  - `GameParameters.ts` - Central configuration file containing all adjustable game parameters
- **Terrain/**
  - `LightingSystem.ts` - Handles dynamic lighting, sun movement, and sky rendering
  - `TerrainSystem.ts` - Manages terrain generation and rendering
  - `ReflectionSystem.ts` - Handles surface reflections and lighting effects
- **Shaders/**
  - Contains GLSL shader code for various visual effects
- **UI/**
  - Engine-specific UI components and controls

### User Interface (`src/ui/`)

- Contains React components for the game's user interface
- Includes control panels, menus, and HUD elements

### Types (`src/types/`)

- TypeScript type definitions and interfaces
- Ensures type safety across the application

## Key Features

### Lighting System

The lighting system (`LightingSystem.ts`) manages:
- Dynamic sun positioning and movement
- Sky color gradients and transitions
- Sun size scaling based on height
- Color transitions for sunset/sunrise effects
- Halo and atmospheric effects

Key parameters are defined in `GameParameters.ts` under `LightingParameters`:
- Sun geometry and appearance
- Color transition thresholds
- Scaling factors
- Light intensities

### Terrain System

The terrain system handles:
- Procedural terrain generation
- Surface materials and textures
- Height mapping and noise generation
- Edge detection and highlighting

### Reflection System

Manages surface reflections including:
- Sun reflection calculations
- Surface material properties
- Dynamic reflection intensity

## Configuration

All game parameters are centralized in `GameParameters.ts`, organized into categories:
- `GridParameters` - Grid system settings
- `TerrainParameters` - Terrain generation parameters
- `LightingParameters` - Lighting and atmospheric effects
- `ReflectionParameters` - Surface reflection properties
- `CameraParameters` - Camera settings
- `CoordinateMarkerParameters` - World coordinate display settings

## Development Guidelines

1. **Parameter Management**
   - Add new parameters to `GameParameters.ts` when possible
   - Use strongly typed constants
   - Include detailed comments for each parameter

2. **System Architecture**
   - Follow singleton pattern for major systems
   - Use dependency injection for system dependencies
   - Maintain clear separation of concerns

3. **Performance Considerations**
   - Use efficient data structures
   - Implement proper disposal methods
   - Consider memory management in render loops

4. **Documentation**
   - Keep this document updated with new features
   - Document complex algorithms and calculations
   - Include parameter descriptions and units 