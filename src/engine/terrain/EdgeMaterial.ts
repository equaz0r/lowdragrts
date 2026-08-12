import {
    LineBasicMaterial,
    AdditiveBlending,
} from 'three';
import { EdgeParameters, normalizeEdgeLayerHeights } from '../config/TerrainConfig';

export interface EdgeUniforms {
    [key: string]: { value: any };
}

export interface EdgeMaterialResult {
    material: LineBasicMaterial;
    uniforms: EdgeUniforms;
}

/**
 * Creates the edge-grid line material with the 5-layer height-colour ramp and
 * animated electric pulse shader.
 *
 * Returns both the compiled material AND the live uniform map.
 * TerrainGenerator stores the uniforms so EdgeControls can mutate them directly
 * for live appearance changes without triggering a terrain regen.
 */
export function createEdgeMaterial(minHeight: number, maxHeight: number): EdgeMaterialResult {
    const layers = EdgeParameters.layers;

    // Smoothstep thresholds must be strictly ascending.
    normalizeEdgeLayerHeights(layers);

    const uniforms: EdgeUniforms = {
        layerHeights:     { value: new Float32Array(layers.map(l => l.heightFraction)) },
        layerColors:      { value: layers.map(l => l.color.clone()) },
        layerIntensities: { value: new Float32Array(layers.map(l => l.intensity)) },
        time:             { value: 0 },
        pulseSpeed:       { value: EdgeParameters.pulseSpeed },
        pulseIntensity:   { value: EdgeParameters.pulseIntensity },
        pulseWidth:       { value: EdgeParameters.pulseWidth },
        minTerrainHeight: { value: minHeight },
        maxTerrainHeight: { value: maxHeight },
    };

    const material = new LineBasicMaterial({
        transparent: true,
        opacity:     1.0,
        blending:    AdditiveBlending,
        depthWrite:  false,
    });

    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);

        // ── Vertex: pass world Y and XZ to fragment ───────────────────────────
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
            varying float vWorldY;
            varying vec2  vWorldXZ;`
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vec4 _wpos = modelMatrix * vec4( transformed, 1.0 );
            vWorldY  = _wpos.y;
            vWorldXZ = _wpos.xz;`
        );

        // ── Fragment: 5-layer colour ramp + animated pulse ────────────────────
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
            varying float vWorldY;
            varying vec2  vWorldXZ;

            uniform float minTerrainHeight;
            uniform float maxTerrainHeight;
            uniform float layerHeights[5];
            uniform vec3  layerColors[5];
            uniform float layerIntensities[5];
            uniform float time;
            uniform float pulseSpeed;
            uniform float pulseIntensity;
            uniform float pulseWidth;

            // Hash 80-world-unit cells for per-edge timing variation
            float edgeHash( vec2 p ) {
                vec2 ip = floor( p / 80.0 );
                return fract( sin( dot( ip, vec2(127.1, 311.7) ) ) * 43758.5453 );
            }

            // Progressive smoothstep blend through 5 layers
            vec3 sampleLayers( float t ) {
                vec3 c = layerColors[0] * layerIntensities[0];
                c = mix( c, layerColors[1] * layerIntensities[1], smoothstep( layerHeights[0], max(layerHeights[0]+0.001, layerHeights[1]), t ) );
                c = mix( c, layerColors[2] * layerIntensities[2], smoothstep( layerHeights[1], max(layerHeights[1]+0.001, layerHeights[2]), t ) );
                c = mix( c, layerColors[3] * layerIntensities[3], smoothstep( layerHeights[2], max(layerHeights[2]+0.001, layerHeights[3]), t ) );
                c = mix( c, layerColors[4] * layerIntensities[4], smoothstep( layerHeights[3], max(layerHeights[3]+0.001, layerHeights[4]), t ) );
                return c;
            }

            // Single upward pulse: sharp leading edge, exponential trailing glow
            float onePulse( float y, float pos, float w ) {
                float d       = pos - y;
                float trailing = exp( -max(0.0, -d) / w );
                float leading  = exp( -max(0.0,  d) / (w * 0.12) );
                return trailing * leading;
            }

            // Three overlapping pulses with independent speeds + per-edge phase offsets
            vec3 computePulse( float y, float eh ) {
                float i1 = onePulse( y, fract(time*pulseSpeed          + eh),             pulseWidth );
                float i2 = onePulse( y, fract(time*pulseSpeed*0.61     + eh*0.73 + 0.33), pulseWidth*1.5  ) * 0.65;
                float i3 = onePulse( y, fract(time*pulseSpeed*0.37     + eh*1.31 + 0.67), pulseWidth*2.1  ) * 0.45;
                float total = i1 + i2 + i3;
                // Electric colour: deep purple at low heights → warm orange at
                // peaks — matches the layer ramp's navy->purple->pink->orange story.
                vec3 pColor = mix( vec3(0.4, 0.05, 0.6), vec3(1.0, 0.55, 0.1), y );
                return pColor * total * pulseIntensity;
            }`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float _range = max(1.0, maxTerrainHeight - minTerrainHeight);
            float _ny    = clamp((vWorldY - minTerrainHeight) / _range, 0.0, 1.0);
            float _eh    = edgeHash(vWorldXZ);
            diffuseColor.rgb = sampleLayers(_ny) + computePulse(_ny, _eh);`
        );

        (material as any).customShader = shader;
    };

    return { material, uniforms };
}
