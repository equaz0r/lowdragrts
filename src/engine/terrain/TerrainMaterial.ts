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

// "Sea" shimmer — see the comment inside calculateReflection() for what this
// actually does and why. Not exposed as sliders (yet) — revisit if it needs
// live tuning, same as the sun scanline constants in LightingSystem.ts.
//
// Fraction is of `height / heightScale` — DELIBERATELY the same normalisation
// TerrainGenerator's vertex-colour gradient uses (`normalizedHeight` in
// generate()'s second pass), NOT a fraction of this generation's actual
// min/max height range. Those two are different things: min/max-relative is
// vulnerable to one unrelated low/high outlier elsewhere on the map skewing
// where "low" starts, so a visually-dark (low height/heightScale) area can
// land well outside a min/max-relative threshold band. heightScale-relative
// always matches what actually reads as dark, regardless of where this
// particular seed's extremes happen to fall.
const SEA_LEVEL_FRACTION = 0.06;
const SEA_FADE_BAND      = 0.10;
const SEA_WAVE_FREQUENCY = 0.003;
const SEA_WAVE_SPEED     = 0.9;  // was 0.45 — "visible but too subtle/slow" feedback
const SEA_WAVE_STRENGTH  = 0.5;  // was 0.30, same reason

// Sun "glitter path" specular (11 Aug 2026 rewrite) — see calculateSunGlitter()
// in the fragment shader below for the full reasoning. Replaces an earlier
// screen-space "fake tracking" hack that could only ever produce a single
// small blob, never the wide camera-converging wedge real sun-glitter on a
// wavy surface actually looks like (confirmed against Simon's hand-annotated
// screenshot, 11 Aug 2026 — see the plan doc). These are implementation
// constants for the noise itself (frequency/speed/amplitude/shininess) —
// same role as the SEA_WAVE_* constants above. The overall WEIGHT this term
// contributes to the reflection blend lives in ReflectionParameters
// (SUN_GLITTER_WEIGHT) alongside its sibling weights, not here.
const GLITTER_FREQUENCY = 0.05;  // world-units^-1 — fine grain, scattered flecks not broad waves
const GLITTER_SPEED     = 0.6;
const GLITTER_AMPLITUDE = 0.35;  // normal-tilt strength — see calculateSunGlitter() for the tradeoff
const GLITTER_SHININESS = 36.0;  // Blinn-Phong exponent — tolerance width of each sparkle point

/**
 * Creates the main terrain surface material with the reflection + panel shader.
 * Extracted from TerrainGenerator to keep material authoring self-contained.
 *
 * The compiled shader is stored as (material as any).customShader so that
 * TerrainGenerator.update() can push per-frame uniform values (camera/sun
 * direction, time) without holding a separate reference.
 *
 * @param heightScale  This generation's config.heightScale — see the sea
 *   shimmer constants above for why this, not min/max height.
 */
export function createTerrainMaterial(totalSize: number, heightScale: number): MeshStandardMaterial {
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

        // Raw sun world position (not a normalized direction) — the glitter
        // calculation below needs a POINT to compute "direction from this
        // fragment to sun" per-fragment, not a single direction-from-origin
        // (see the reflection function for why that distinction turned out
        // to matter twice already this session).
        s.uniforms.sunWorldPosition = { value: new Vector3() };
        // No custom camera uniform needed — see the fragment shader below,
        // this now uses Three's own built-in `cameraPosition` uniform
        // (declared by #include <common> itself, populated automatically
        // every frame, no manual push required).
        s.uniforms.gridSize        = { value: totalSize };
        s.uniforms.reflectionParams = { value: ReflectionParameters.REFLECTION_PARAMS };
        s.uniforms.sunColor        = { value: new Color(1.0, 0.98, 0.9) };
        s.uniforms.heightScale     = { value: heightScale };
        // Was never actually declared in the GLSL below despite TerrainGenerator.
        // update() pushing a value into shader.uniforms.time every frame — the JS
        // object had it, but with no matching `uniform float time;` in the source,
        // the GPU never received it. Harmless before (nothing read it); now the
        // sea shimmer does, so the declaration below actually matters.
        s.uniforms.time            = { value: 0 };

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
            uniform vec3 sunWorldPosition;
            uniform vec4 reflectionParams;
            uniform vec3 sunColor;
            uniform float heightScale;
            uniform float time;
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

            float glitterHash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            /**
             * Scattered "sun glitter" specular highlight — deliberately generic
             * (world position, geometric normal, sun direction, view direction,
             * time only; no terrain-specific state) so this can be reused for
             * other materials later (buildings, units) without rework.
             *
             * NOT a single aligned point (see the screen-space "fake tracking"
             * approach this replaced, 11 Aug 2026) — real sun glitter on a wavy
             * surface is a WIDE, camera-converging wedge that emerges naturally
             * from per-fragment specular against a noisy normal field: wide near
             * the light source (shallow grazing view angle -> a small normal
             * jitter redirects the reflection a long lateral distance -> many
             * fragments qualify) and narrow near the viewer (steep view angle ->
             * only a very precise jitter qualifies -> few fragments do). Don't
             * hand-shape that falloff — if the wedge doesn't spread/narrow
             * correctly, the levers are amplitude/frequency/shininess below, not
             * a geometric mask (that's the failure mode this replaced).
             */
            float calculateSunGlitter(vec3 worldPos, vec3 geomNormal, vec3 sunDir, vec3 viewDir, float time) {
                vec2 cell = worldPos.xz * ${GLITTER_FREQUENCY.toFixed(3)}
                    + vec2(time * ${GLITTER_SPEED.toFixed(2)}, time * ${(GLITTER_SPEED * 0.7).toFixed(2)});
                float n1 = glitterHash(cell);
                float n2 = glitterHash(cell * 1.7 + 11.3);
                vec2 tilt = (vec2(n1, n2) - 0.5) * 2.0 * ${GLITTER_AMPLITUDE.toFixed(2)};
                vec3 jitteredNormal = normalize(geomNormal + vec3(tilt.x, 0.0, tilt.y));

                vec3 halfDir = normalize(sunDir + viewDir);
                float nDotH = max(0.0, dot(jitteredNormal, halfDir));
                float spec = pow(nDotH, ${GLITTER_SHININESS.toFixed(1)});

                // Don't glint on facets fundamentally facing away from the sun,
                // and fade out on steep cliff faces — rolling ground and gentle
                // mountainside only, vertical rock should read as solid stone.
                float facingSun = max(0.0, dot(geomNormal, sunDir));
                float slopeWeight = smoothstep(0.1, 0.4, abs(geomNormal.y));
                return spec * facingSun * slopeWeight;
            }

            float calculateReflection() {
                vec3 normalizedNormal = normalize(vWorldNormal);

                // "Sea" shimmer: low/flat ground reads as a dark, still plain by
                // default (nothing moves there — the mesh is static, so a flat
                // area's normal never changes frame to frame). This perturbs the
                // normal used for reflection ONLY (not vWorldNormal itself, so
                // real diffuse/specular shading elsewhere stays geometrically
                // correct) with a cheap time-varying wave, gated to low ground —
                // makes the glint dance like light on water without displacing
                // any actual vertex. Far cheaper than real ripples: those would
                // need matching displacement in EdgeMaterial.ts too (the grid is
                // separate static geometry — it'd visibly detach from a moving
                // surface otherwise) plus analytic normal recomputation for
                // correct lighting on the displaced surface.
                float seaHeightFrac = clamp(vWorldPosition.y / max(1.0, heightScale), 0.0, 1.0);
                float seaMask = 1.0 - smoothstep(${SEA_LEVEL_FRACTION.toFixed(2)}, ${(SEA_LEVEL_FRACTION + SEA_FADE_BAND).toFixed(2)}, seaHeightFrac);
                if (seaMask > 0.001) {
                    vec2 waveUV = vWorldPosition.xz * ${SEA_WAVE_FREQUENCY.toFixed(4)} + vec2(time * ${SEA_WAVE_SPEED.toFixed(2)}, time * ${(SEA_WAVE_SPEED * 0.7).toFixed(2)});
                    float waveA = sin(waveUV.x + waveUV.y * 0.5) + sin(waveUV.x * 0.6 - waveUV.y * 1.3 + 1.7) * 0.6;
                    float waveB = sin(waveUV.y * 1.1 - waveUV.x * 0.4 + 2.3);
                    normalizedNormal = normalize(normalizedNormal + vec3(waveA, 0.0, waveB) * ${SEA_WAVE_STRENGTH.toFixed(2)} * seaMask);
                }

                // Per-fragment view direction — camera's built-in world position
                // (Three's own uniform, declared by #include <common> above) minus
                // THIS fragment's world position. Was normalize(cameraPosition) alone
                // — i.e. direction from the ORIGIN to the camera, one single vector
                // reused for every fragment on the whole 8000-unit map regardless of
                // where that fragment actually is. That only happens to be correct
                // for fragments AT the origin; everywhere else the reflection glint
                // pointed increasingly wrong, worse the further off-centre or the
                // further from the origin a fragment was — which is exactly the
                // "aligns only looking straight down the middle" symptom.
                vec3 normalizedCameraDir = normalize(cameraPosition - vWorldPosition);

                // Sun "glitter path" — see calculateSunGlitter() above for the
                // full reasoning (11 Aug 2026 rewrite). Replaces an earlier
                // screen-space "fake tracking" hack that compared camera->
                // fragment against camera->sun direction: that could only ever
                // produce a single small aligned blob, never the wide,
                // camera-converging wedge Simon's hand-annotated screenshot
                // showed real sun glitter should look like. Uses the clean
                // (pre-sea-shimmer) geometric normal as its base — kept
                // separate/additive from the sea shimmer above, different
                // frequency/amplitude/purpose, not merged.
                vec3 fragToSun = normalize(sunWorldPosition - vWorldPosition);
                vec3 geomNormal = normalize(vWorldNormal);
                float sunGlitter = calculateSunGlitter(vWorldPosition, geomNormal, fragToSun, normalizedCameraDir, time);

                float distanceFromWest = (vWorldPosition.x + ${ReflectionParameters.WEST_FALLOFF_START.toFixed(1)}) / ${ReflectionParameters.WEST_FALLOFF_LENGTH.toFixed(1)};
                // max() guard: smoothstep(edge0, edge1, x) is undefined behaviour (divide-by-
                // zero internally) when edge0 == edge1 — reflectionParams.z reaching exactly
                // 0 (its slider's own minimum) produced NaN here, which blooms into a big
                // white blowout downstream. Floor keeps it defined at every slider position.
                float positionFactor = smoothstep(0.0, max(0.001, reflectionParams.z), 1.0 - distanceFromWest);

                float panelFactor = getPanelFactor();

                float heightFactor = 1.0 - abs(normalizedNormal.y);
                heightFactor = pow(heightFactor, ${ReflectionParameters.HEIGHT_FACTOR_POWER.toFixed(2)});

                float grazingDot = 1.0 - abs(dot(normalizedNormal, normalizedCameraDir));
                float grazingFactor = pow(grazingDot, ${ReflectionParameters.GRAZING_FACTOR_POWER.toFixed(2)});

                float totalFactor = pow(
                    sunGlitter     * ${ReflectionParameters.SUN_GLITTER_WEIGHT.toFixed(2)} +
                    positionFactor * ${ReflectionParameters.POSITION_FACTOR_WEIGHT.toFixed(2)} +
                    panelFactor    * ${ReflectionParameters.PANEL_FACTOR_WEIGHT.toFixed(2)} +
                    grazingFactor * heightFactor * ${ReflectionParameters.GRAZING_FACTOR_WEIGHT.toFixed(2)},
                    reflectionParams.w
                );

                // clamp, not max(): totalFactor was UNCLAMPED ABOVE — the weighted sum
                // routinely exceeds 1.0 (measured ~91% of realistic viewing angles before
                // this fix), and pow() only makes an already->1 value larger. That
                // unclamped value then fed THREE separate mix() calls below/downstream as
                // a blend factor; GLSL's mix() doesn't clamp its factor either, so values
                // >1 extrapolate PAST their target (negative roughness, metalness >1,
                // diffuseColor overshoot) instead of blending toward it. This was the
                // actual source of the pervasive overbrightness — not sun/metalness/
                // roughness, which is why tuning those had no effect.
                return clamp(totalFactor, ${ReflectionParameters.MIN_REFLECTION.toFixed(2)}, 1.0);
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
