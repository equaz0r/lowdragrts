import {
    MeshStandardMaterial,
    DoubleSide,
    Color,
    Vector3,
    Vector2,
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

// Sun "glitter path" (11 Aug 2026, third rewrite) — see calculateSunGlitter()
// in the fragment shader below for the full reasoning. History: attempt 1
// (screen-space camera->sun alignment) could only ever produce a single small
// blob. Attempt 2 (jittering the terrain normal before a Blinn-Phong test,
// hoping the wedge would emerge on its own) was verified WRONG by direct
// numeric simulation — it produces the shape backwards for this game's
// specific camera/sun geometry (wide near camera, narrow near horizon). This
// version explicitly authors the wedge envelope along the real camera->sun
// ground axis (grounded in actual live positions, not an arbitrary mask) and
// textures it with noise for sparkle.
//
// Round 4 (still 11 Aug 2026): even with the axis maths verified correct
// (it DOES converge exactly on the sun's true screen position — checked
// numerically for an off-axis camera too), Simon reported the visible
// wedge still reads as a thin, slightly-misaligned LINE rather than a wide
// patch. Root cause, also found by simulation: the axis only converges on
// the sun in the FAR limit (as along -> distance to sun); the NEAR-camera
// portion — which is what's actually most visible on screen, per the
// frustum analysis above — is genuinely offset from "dead centre on the
// sun" for any camera that isn't looking directly along that axis. That's
// real, correct geometry for a THIN line, not a bug — but a thin line makes
// that imprecision obvious, while a WIDE patch (like real photographed sun
// glitter) reads as "roughly in the sun's direction" regardless. Fix:
// reach full width much sooner (smaller ALONG_FAR, WIDTH_POWER<1 for fast
// early growth) so width — not pixel-perfect alignment — carries the
// "pointing at the sun" read. ALONG_FAR/WIDTH_FAR are also runtime uniforms
// now (`glitterReach`, ReflectionControls' "Sun Glitter" section) since
// getting these exactly right depends on Simon's actual play-camera
// distance, which live sliders answer far faster than another guess-and-
// ship round-trip.
const GLITTER_FREQUENCY = 0.03;  // world-units^-1 — sparkle texture grain within the wedge
const GLITTER_SPEED     = 0.6;
// Wedge envelope: WIDTH_NEAR/WIDTH_FAR are world-unit half-widths of the
// glitter band at ALONG_NEAR/ALONG_FAR (world-unit distances from the camera
// along the camera->sun ground axis — NOT distance to the sun itself, which
// is 8000+ units away and mostly off the visible terrain). ALONG_NEAR isn't
// 0: for most camera angles the ground directly at the camera's feet isn't
// even in the view frustum (you're not looking straight down), so the
// visible "near" end of the wedge is always some distance out — verified
// against the simulated camera frustum, not guessed. ALONG_FAR/WIDTH_FAR
// below are just the INITIAL values for the `glitterReach` uniform (live
// slider-adjustable from here on) — NEAR_WIDTH/ALONG_NEAR/WIDTH_POWER stay
// baked constants, less critical to live-tune than reach/width were.
const GLITTER_ALONG_NEAR  = 250;
const GLITTER_ALONG_FAR   = 2500;   // was 6000 — reach full width much sooner
const GLITTER_WIDTH_NEAR  = 70;     // was 50
const GLITTER_WIDTH_FAR   = 1200;   // was 1800 — see glitterReach uniform, live-adjustable
const GLITTER_WIDTH_POWER = 0.8;    // was 1.4 (>1 = slow start) — now <1 = fast early growth
const GLITTER_SPARKLE_CONTRAST = 2.5; // higher = fewer, brighter individual flecks vs. an even wash
// Floor so the wedge's SHAPE stays visible even where the sparkle noise
// happens to be dim that frame — without this, a narrow/sparse stretch (e.g.
// near the camera, where fewer noise cells fit across the width) could look
// "empty" purely by noise bad luck rather than reading as a deliberate taper.
const GLITTER_BASE_GLOW = 0.25;

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
        // Sun glitter reach/width (x = GLITTER_ALONG_FAR, y = GLITTER_WIDTH_FAR) —
        // live-adjustable via ReflectionControls' "Sun Glitter" sliders, NOT baked
        // into the shader template like the other GLITTER_* constants, because how
        // far the wedge needs to reach before hitting full width depends on the
        // player's actual camera distance, which only live tuning can answer.
        s.uniforms.glitterReach    = { value: new Vector2(GLITTER_ALONG_FAR, GLITTER_WIDTH_FAR) };
        // Debug isolation mode (11 Aug 2026, round 10) — after several rounds
        // where it was genuinely unclear whether the visible "reflection" was
        // sunGlitter, the ambient weighted-sum terms, or Three's own built-in
        // PBR specular, this renders sunGlitter's raw [0,1] output directly as
        // greyscale (bypassing diffuseColor mixing) AND forces roughness/
        // metalness to fully non-reflective, so Three's built-in specular
        // can't contribute anything either. What you see with this on is
        // ONLY calculateSunGlitter()'s actual output — nothing else.
        s.uniforms.debugShowGlitter = { value: 0 };
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
            uniform vec2 glitterReach; // x = along-distance for full width, y = full width itself
            uniform float debugShowGlitter; // >0.5 = render calculateSunGlitter()'s raw output only
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying vec2 vGridPosition;
            // Written inside calculateReflection(), read in the color_fragment
            // injection below — GLSL file-scope global, not a varying/uniform.
            // Only exists to let the debug isolation view see sunGlitter's raw
            // value without duplicating the calculateSunGlitter() call.
            float debugGlitterValue = 0.0;

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
             * Sun "glitter path" — an explicitly authored wedge envelope along
             * the real camera->sun ground axis (grounded in actual live
             * positions, not an arbitrary mask), textured with per-fragment
             * noise for sparkle/twinkle. Deliberately generic (world position,
             * geometric normal, sun position, camera position, time only; no
             * terrain-specific state) so this can be reused for other materials
             * later (buildings, units) without rework.
             *
             * Why explicit, not emergent: two earlier attempts — a screen-space
             * camera->sun alignment hack, then jittering the terrain normal
             * before a Blinn-Phong test and hoping the wedge shape would emerge
             * on its own — were BOTH verified wrong by direct numeric
             * simulation (not just visual guessing): the jittered-normal
             * version produces the shape backwards for this game's specific
             * camera/sun geometry (wide near the camera, narrow near the
             * horizon). That same simulation caught a second real bug: gating
             * brightness by dot(normal, sunDir) is correct for DIFFUSE light
             * (Lambert's cosine law) but wrong for this SPECULAR effect — real
             * mirror-like reflection gets STRONGER, not weaker, at grazing/
             * low-sun angles (Fresnel). That gate was crushing brightness
             * exactly when the sun is low and large — matching the observed
             * "gets worse as the sun gets bigger" symptom. Below it's used
             * only as a soft on/off GATE (facing the sun's general hemisphere
             * at all), not a continuous dimmer.
             */
            float calculateSunGlitter(vec3 worldPos, vec3 geomNormal, vec3 sunPos, vec3 camPos, float time) {
                vec2 camXZ = camPos.xz;
                vec2 sunXZ = sunPos.xz;
                vec2 fragXZ = worldPos.xz;
                vec2 axis = normalize(sunXZ - camXZ);
                vec2 toFrag = fragXZ - camXZ;
                float along = dot(toFrag, axis);
                float inFront = step(0.0, along);

                vec2 perp = toFrag - axis * along;
                float lateralOffset = length(perp);

                // glitterReach.x/.y (alongFar/widthFar) are live-adjustable — see
                // the uniform declaration above for why. max() guard: same
                // smoothstep/divide-by-zero gotcha as reflectionParams.z elsewhere
                // in this file if the reach slider ever got dragged down to
                // GLITTER_ALONG_NEAR exactly.
                float t = clamp((along - ${GLITTER_ALONG_NEAR.toFixed(1)}) / max(1.0, glitterReach.x - ${GLITTER_ALONG_NEAR.toFixed(1)}), 0.0, 1.0);
                float allowedWidth = mix(${GLITTER_WIDTH_NEAR.toFixed(1)}, glitterReach.y, pow(t, ${GLITTER_WIDTH_POWER.toFixed(2)}));
                float wedgeFactor = 1.0 - smoothstep(allowedWidth * 0.5, allowedWidth, lateralOffset);

                vec2 cell = worldPos.xz * ${GLITTER_FREQUENCY.toFixed(3)}
                    + vec2(time * ${GLITTER_SPEED.toFixed(2)}, time * ${(GLITTER_SPEED * 0.7).toFixed(2)});
                float n = glitterHash(cell);
                float sparkle = pow(n, ${GLITTER_SPARKLE_CONTRAST.toFixed(2)});

                vec3 sunDir = normalize(sunPos - worldPos);
                float facingSunGate = smoothstep(-0.05, 0.05, dot(geomNormal, sunDir));

                return wedgeFactor * mix(${GLITTER_BASE_GLOW.toFixed(2)}, 1.0, sparkle) * facingSunGate * inFront;
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
                // full reasoning (11 Aug 2026, third rewrite). Uses the clean
                // (pre-sea-shimmer) geometric normal as its base — kept
                // separate/additive from the sea shimmer above, different
                // frequency/amplitude/purpose, not merged.
                vec3 geomNormal = normalize(vWorldNormal);
                float sunGlitter = calculateSunGlitter(vWorldPosition, geomNormal, sunWorldPosition, cameraPosition, time);
                debugGlitterValue = sunGlitter; // for the debug isolation view — see uniform declaration above

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
            diffuseColor.rgb = mix(diffuseColor.rgb, reflectionColor, reflectionStrength * ${ReflectionParameters.REFLECTION_BLEND.toFixed(1)});
            // Debug isolation (see uniform declaration above): overrides
            // EVERYTHING computed above with sunGlitter's raw [0,1] value as
            // flat greyscale. Comes AFTER the normal mixing on purpose — this
            // always wins when the toggle is on, regardless of what the rest
            // of calculateReflection() decided.
            if (debugShowGlitter > 0.5) {
                diffuseColor.rgb = vec3(debugGlitterValue);
            }`
        );

        s.fragmentShader = s.fragmentShader.replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            roughnessFactor = mix(reflectionParams.y, 0.1, reflectionStrength);
            // Force fully non-reflective in debug mode too — otherwise Three's
            // own built-in specular highlight (see LightingConfig.ts's
            // REFLECTION_PARAMS comment) would still show up ON TOP of the
            // greyscale debug view and defeat the whole point of isolating
            // sunGlitter.
            if (debugShowGlitter > 0.5) { roughnessFactor = 1.0; }`
        );

        s.fragmentShader = s.fragmentShader.replace(
            '#include <metalnessmap_fragment>',
            `#include <metalnessmap_fragment>
            metalnessFactor = mix(reflectionParams.x, 1.0, reflectionStrength);
            if (debugShowGlitter > 0.5) { metalnessFactor = 0.0; }`
        );

        (material as any).customShader = s;
    };

    return material;
}
