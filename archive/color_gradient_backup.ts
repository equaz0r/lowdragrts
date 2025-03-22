// Color gradient system backup from TerrainGenerator.ts
// This contains the multi-color gradient system we developed

const gradientColors = {
    base: 0xff2200,    // Red base
    orange: 0xff6600,  // Red-orange
    yellow: 0xffaa00,  // Orange-yellow
    purple: 0xff33ff,  // Bright purple
    cyan: 0x00ffff,    // Cyan
    blue: 0x0066ff     // Dark blue
};

const heightGradients = {
    threshold: 5.0,    // Base height threshold
    gradient1: 5.0,    // Red to red-orange
    gradient2: 15.0,   // Red-orange to orange-yellow
    gradient3: 25.0,   // Orange-yellow to purple
    gradient4: 35.0,   // Purple to cyan
    gradient5: 45.0    // Cyan to dark blue
};

/*
Fragment shader color calculation:

vec3 getHeightColor(float height) {
    // Base level (red)
    if (height <= heightGradient1) {
        return edgeColorBase;
    }
    // Red to red-orange gradient
    else if (height <= heightGradient2) {
        float t = (height - heightGradient1) / (heightGradient2 - heightGradient1);
        t = smoothstep(0.0, 1.0, t);
        return mix(edgeColorBase, edgeColorOrange, t);
    }
    // Red-orange to orange-yellow gradient
    else if (height <= heightGradient3) {
        float t = (height - heightGradient2) / (heightGradient3 - heightGradient2);
        t = smoothstep(0.0, 1.0, t);
        return mix(edgeColorOrange, edgeColorYellow, t);
    }
    // Orange-yellow to purple gradient
    else if (height <= heightGradient4) {
        float t = (height - heightGradient3) / (heightGradient4 - heightGradient3);
        t = smoothstep(0.0, 1.0, t);
        return mix(edgeColorYellow, edgeColorPurple, t);
    }
    // Purple to cyan gradient
    else if (height <= heightGradient5) {
        float t = (height - heightGradient4) / (heightGradient5 - heightGradient4);
        t = smoothstep(0.0, 1.0, t);
        return mix(edgeColorPurple, edgeColorCyan, t);
    }
    // Cyan to dark blue gradient
    else {
        float t = clamp((height - heightGradient5) / 10.0, 0.0, 1.0);
        t = smoothstep(0.0, 1.0, t);
        return mix(edgeColorCyan, edgeColorBlue, t);
    }
}
*/ 