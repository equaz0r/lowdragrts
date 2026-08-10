import {
    MeshStandardMaterial,
    DoubleSide,
    Color,
    Vector3,
} from 'three';
import { TerrainParameters } from '../config/TerrainConfig';
import { ReflectionParameters } from '../config/LightingConfig';

// Three.js narrows onBeforeCompile's shader argument to WebGLProgramParameters
// which doesn't expose uniforms in its public type. This local interface matches
// the actual runtime shape so we can type the uniform assignments safely.
interface ShaderWithUniforms {
    uniforms: { [uniform: string]: { value: any } };
    vertexShader: string;
    fragmentShader: string;
}

/**
 * Creates the main terrain surface material with the reflection + panel shader.
 * Extracted from TerrainGenerator to keep material authoring self-contained.
 *
 * The compiled shader is stored as (material as any).customShader so that
 * TerrainGenerator.update() can push per-frame uniform values (camera direction,
 * time) without holding a separate reference.
 */
export function createTerrainMaterial(totalSize: number): MeshStandardMaterial {
    const material = new MeshStandardMaterial({
        vertexColors: true,
        wireframe:    TerrainParameters.USE_WIREFRAME,
        metalness:    TerrainParameters.MATERIAL_METALNESS,
        roughness:    TerrainParameters.MATERIAL_ROUGHNESS,
        flatShading:  TerrainParameters.USE_FLAT_SHADING,
        side:         DoubleSide,
    });

    material.onBeforeCompile = (shader) => {
        const s = shader as unknown as ShaderWithUniforms;

        s.uniforms.sunDirection    = { value: new Vector3(-1, 0.3, 0).normalize() };
        s.uniforms.cameraDirection = { value: new Vector3() };
        s.uniforms.gridSize        = { value: totalSize };
        s.uniforms.reflectionParams = { value: ReflectionParameters.REFLECTION_PARAMS };
        s.uniforms.sunColor        = { value: new Color(1.0, 0.98, 0.9) };

        // ── Vertex shader ─────────────────────────────────────────────────────
        s.vertexShader = s.vertexShader.replace(
            '#include <common>',
            `#include <common>
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying vec2 vGridPosition;`
        );
        s.vertexShader = s.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            vWorldNormal = normalize(normalMatrix * normal);
            vGridPosition = position.xz / 100.0;`
        );

        // ── Fragment shader ───────────────────────────────────────────────────
        s.fragmentShader = s.fragmentShader.replace(
            '#include <common>',
            `#include <common>
            uniform vec3 sunDirection;
            uniform vec3 cameraDirection;
            uniform vec4 reflectionParams;
            uniform vec3 sunColor;
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying vec2 vGridPosition;

            float getPanelFactor() {
                vec2 grid = floor(vGridPosition);
                vec2 frac = fract(vGridPosition);
                float border = step(0.1, max(frac.x, frac.y));
                float variation = fract(sin(dot(grid, vec2(12.9898, 78.233))) * 43758.5453);
                return mix(1.0, 0.7, border) * (0.9 + 0.1 * variation);
            }

            float calculateReflection() {
                vec3 normalizedNormal = normalize(vWorldNormal);
                vec3 normalizedCameraDir = normalize(cameraDirection);

                float sunDot = max(0.0, dot(normalizedNormal, sunDirection));
                float sunFactor = pow(sunDot, ${ReflectionParameters.SUN_FACTOR_POWER.toFixed(2)});

                vec3 reflectionDir = reflect(-sunDirection, normalizedNormal);
                float viewDot = max(0.0, dot(normalizedCameraDir, reflectionDir));
                float viewFactor = pow(viewDot, ${ReflectionParameters.VIEW_FACTOR_POWER.toFixed(2)});

                float distanceFromWest = (vWorldPosition.x + ${ReflectionParameters.WEST_FALLOFF_START.toFixed(1)}) / ${ReflectionParameters.WEST_FALLOFF_LENGTH.toFixed(1)};
                float positionFactor = smoothstep(0.0, reflectionParams.z, 1.0 - distanceFromWest);

                float panelFactor = getPanelFactor();

                float heightFactor = 1.0 - abs(normalizedNormal.y);
                heightFactor = pow(heightFactor, ${ReflectionParameters.HEIGHT_FACTOR_POWER.toFixed(2)});

                float grazingDot = 1.0 - abs(dot(normalizedNormal, normalizedCameraDir));
                float grazingFactor = pow(grazingDot, ${ReflectionParameters.GRAZING_FACTOR_POWER.toFixed(2)});

                float totalFactor = pow(
                    viewFactor     * ${ReflectionParameters.VIEW_FACTOR_WEIGHT.toFixed(1)} +
                    sunFactor      * ${ReflectionParameters.SUN_FACTOR_WEIGHT.toFixed(1)} +
                    positionFactor * ${ReflectionParameters.POSITION_FACTOR_WEIGHT.toFixed(1)} +
                    panelFactor    * ${ReflectionParameters.PANEL_FACTOR_WEIGHT.toFixed(1)} +
                    grazingFactor * heightFactor * ${ReflectionParameters.GRAZING_FACTOR_WEIGHT.toFixed(1)},
                    reflectionParams.w
                );

                return max(${ReflectionParameters.MIN_REFLECTION.toFixed(2)}, totalFactor);
            }`
        );

        s.fragmentShader = s.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float reflectionStrength = calculateReflection();
            vec3 reflectionColor = sunColor * reflectionStrength;
            diffuseColor.rgb = mix(diffuseColor.rgb, reflectionColor, reflectionStrength * ${ReflectionParameters.REFLECTION_BLEND.toFixed(1)});`
        );

        s.fragmentShader = s.fragmentShader.replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            roughnessFactor = mix(reflectionParams.y, 0.1, reflectionStrength);`
        );

        s.fragmentShader = s.fragmentShader.replace(
            '#include <metalnessmap_fragment>',
            `#include <metalnessmap_fragment>
            metalnessFactor = mix(reflectionParams.x, 1.0, reflectionStrength);`
        );

        (material as any).customShader = s;
    };

    return material;
}
