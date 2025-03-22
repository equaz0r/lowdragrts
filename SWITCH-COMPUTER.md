# Switching Development Environment

This guide helps you continue development of this project on a different computer, maintaining all the current progress and settings.

## Setup Steps

### 1. Initial Repository Setup
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
```

### 2. Development Environment Setup
```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

### 3. Useful Status Commands
```bash
# Check working directory status
git status

# View recent commits (last 5)
git log --oneline -n 5
```

## Prerequisites
1. Node.js and npm installed
2. Cursor IDE installed
3. Git installed and configured

## Verification Steps

### 1. Check Key Files
- `src/engine/terrain/LightingSystem.ts` - Contains sun and lighting implementation
- `src/engine/ui/SunControl.ts` - Contains sun control UI
- `LIGHTING_STATUS.md` - Current progress and next steps

### 2. Verify Functionality
1. Launch the application in browser after starting dev server
2. Verify sun appearance:
   - Perfect circular shape
   - Visible halo effect
   - Smooth movement with slider
   - Proper terrain occlusion
3. Check console for any errors

### 3. Current State
- Branch: terrain-rebuild
- Latest major change: Sun shader improvements and shape fixes
- Look for commit message: "Fixed sun shape distortion, improved shader parameters, updated status with detailed parameter notes and future atmospheric effects"

## Troubleshooting
If the sun appearance isn't correct:
1. Check browser console for errors
2. Verify you're on the correct branch
3. Ensure all dependencies are installed
4. Try clearing browser cache
5. Restart the development server

## Next Steps
Refer to `LIGHTING_STATUS.md` for:
- Current parameters and their effects
- Planned atmospheric effects
- Future improvements
- Technical details

## Development Notes
- All shader parameters are documented in `LIGHTING_STATUS.md`
- The lighting system uses a singleton pattern
- Changes to shader parameters can be tested in real-time
- Current focus is on atmospheric effects implementation 