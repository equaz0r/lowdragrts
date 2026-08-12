import {
    MeshStandardMaterial,
    DoubleSide,
    Color,
    Vector3,
} from 'three';
import { TerrainParameters, GridParameters } from '../config/TerrainConfig';
import { ReflectionParameters } from '../config/LightingConfig';
import { DEFAULT_GLITTER_REACH, TerrainReflectionState } from '../config/ReflectionState';

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
// Was continuous per-fragment hash noise — reads as literal TV static (Simon,
// 12 Aug 2026): unstructured pixel-level randomness, no coherent shape at
// all. Real per-facet glinting (what "shards"/"grid squares catching light"
// actually looks like) needs FLAT, COHERENT patches, not per-pixel noise —
// same fix as getPanelFactor() already uses above (floor() before hashing,
// so a whole cell shares one value instead of every fragment rolling its
// own). First attempt at that fix (still 12 Aug 2026) floored an arbitrary
// ~33-unit coordinate — Simon immediately flagged it as "not aligned,
// looks projected on top of the existing grid, colour doesn't match": an
// unrelated cell size, on top of a coordinate that SCROLLS over time (the
// old animation technique), can never land on the real grid even by
// accident. Fixed properly: shard cells now snap EXACTLY to the same
// GridParameters.CELL_SIZE cells the visible neon grid itself is drawn on
// (same +gridSize/2 half-offset GridSystem.worldToCell() uses — the grid's
// origin isn't cell-aligned with world (0,0) otherwise, since 4000/64 isn't
// an integer). Each glint is now literally "this specific floor panel is
// catching the light", not a coincidentally-similar but separate texture.
const GLITTER_SHARD_SIZE = GridParameters.CELL_SIZE; // world units — same panels the neon grid draws
// No animation constant here any more (12 Aug 2026, round 14) — round 13's
// quantized-time re-roll fixed grid alignment but introduced motion with no
// cause (Simon: shards cycling every couple of seconds on a fully static
// camera and sun). Each shard's brightness is now a pure function of
// position, no time input at all — see calculateSunGlitter() below for how
// it still changes correctly WHEN the camera/sun actually move.
// Thin dark seam between shards (in cell-fraction units, 0-0.5) — the visual
// cue that makes them read as discrete tiles/shards rather than one
// undifferentiated blob whenever several adjacent cells happen to light up
// together. Same purpose as getPanelFactor()'s border, done as a proper
// distance-to-nearest-edge check rather than copying that function's exact
// (slightly odd) formula.
const GLITTER_SHARD_SEAM = 0.06;
// How much of the glint's colour is EMISSIVE (self-glowing, bypasses scene
// lighting entirely) vs. lit reflectionColor mixed into diffuseColor
// (Round 16, 12 Aug 2026) — MeshStandardMaterial is a LIT material:
// diffuseColor is just the albedo INPUT, still multiplied by the scene's
// actual light level (ambient + sunLight) before reaching the screen. With
// Sun Height at its low end (heightFactor clamps to a 0.3 floor — see
// LightingSystem.ts), BOTH lights are dim enough that even a fully-correct,
// bright glint value was getting crushed to near-invisible — Simon saw
// literally nothing with debug off, at any slider setting, because the
// slider changes were all happening in diffuseColor/roughness/metalness,
// none of which matter if there's barely any light to reflect in the first
// place. A "glint" conceptually IS light already bouncing toward the
// camera — it shouldn't need the SCENE's ambient light to be visible any
// more than the sun disc or the neon grid pulse do (both already
// effectively self-lit). Fix: add reflectionColor to totalEmissiveRadiance
// (Three's standard emissive slot — bypasses the lit diffuse/specular BRDF
// pipeline entirely, added straight to the final output), so the glint is
// reliably visible regardless of scene brightness. diffuseColor mixing
// stays too (harmless, adds a bit of properly-lit richness when there IS
// enough ambient/sun light) — this is additive on top, not a replacement.
// Boosted (was 1.0) — Simon: still looks "a bit flat", needs to be brighter
// and read more like a real shiny reflection (12 Aug 2026, round 17).
const GLINT_EMISSIVE_INTENSITY = 2.2;
// Wedge envelope: WIDTH_NEAR is the world-unit half-width of the glitter
// band at ALONG_NEAR (world-unit distance from the camera along the
// camera->sun ground axis — NOT distance to the sun itself, which is 8000+
// units away and mostly off the visible terrain). ALONG_NEAR isn't 0: for
// most camera angles the ground directly at the camera's feet isn't even in
// the view frustum (you're not looking straight down), so the visible
// "near" end of the wedge is always some distance out — verified against
// the simulated camera frustum, not guessed. ALONG_FAR below is just the
// INITIAL value for the `glitterReach` uniform's x component (live
// slider-adjustable from here on, and Simon wants its range extended —
// see ReflectionControls.ts).
const GLITTER_ALONG_NEAR  = 250;
const GLITTER_ALONG_FAR   = DEFAULT_GLITTER_REACH; // was 6000 — reach full width much sooner
const GLITTER_WIDTH_NEAR  = 70;     // was 50
// Round 17 (12 Aug 2026) — the far-end width is no longer a flat constant:
// Simon wants it to automatically track the sun's apparent size (bigger/
// lower sun -> wider glitter), giving example points (sun height -> desired
// width): -0.80 (biggest sun) -> 3000, -0.05 -> 1250, 0.28 -> 850, 0.65
// (smallest sun) -> 250. Fit as a power curve over sunHeightT (same 0..1
// normalisation LightingSystem already uses for the sun's OWN size/colour
// curves — see getSunHeightNormalized()): width = mix(MIN, MAX,
// (1-sunHeightT)^POWER). POWER=1.25 is a compromise fit across Simon's two
// middle data points (their two-point fits gave ~1.11 and ~1.39
// independently — a single power curve can't hit both exactly, this splits
// the difference) — retune if it's visibly off at a specific height.
// glitterReach.y (the old absolute-width uniform) is now a MULTIPLIER on
// top of this curve, not a replacement for it.
const GLITTER_WIDTH_AUTO_MIN   = 250;   // at sunHeightT = 1 (highest/smallest sun)
const GLITTER_WIDTH_AUTO_MAX   = 3000;  // at sunHeightT = 0 (lowest/biggest sun)
const GLITTER_WIDTH_CURVE_POWER = 1.25;
const GLITTER_WIDTH_POWER = 0.8;    // was 1.4 (>1 = slow start) — now <1 = fast early growth
// Round 18 (12 Aug 2026) — Simon confirmed the whole range looks right now
// EXCEPT brightness specifically between sun height -0.56 and -0.80 (the
// low/widest end), which needs to be brighter. Makes sense: at max width
// (up to 3000 * up to a 3.0 slider multiplier = 9000 world units at the
// extreme), the same sparkle density is spread over a much bigger area,
// reading as thinner/dimmer overall even though each individual shard is
// exactly as bright as elsewhere. Boost concentrated steeply toward the low
// end via the same sunHeightT driving the width curve — negligible above
// roughly sunHeightT=0.2 (~sun height -0.51), ramping up toward
// GLINT_LOW_SUN_BOOST_MAX at sunHeightT=0 (height -0.80). First-pass
// numbers — the exact boundary/strength Simon actually wants can only be
// judged live.
const GLINT_LOW_SUN_BOOST_MAX   = 2.0;
const GLINT_LOW_SUN_BOOST_POWER = 6.0;
// Ambient sun glow (round 19, 12 Aug 2026) — see calculateReflection()'s
// positionFactor for the full story: this replaces a fixed distance-from-
// the-west-edge falloff (never actually sun-tracking, just coincidentally
// looked aligned when facing straight at the sun) with the same camera->sun
// ground-axis technique as the glitter wedge, but much wider and
// untextured — a broad soft glow, not sparkly shards. reflectionParams.z
// (the existing "Position Factor" slider, range 0.1-5.0) keeps its UI slot,
// now scaled into a world-unit glow width instead of the old transition
// width. WIDTH_MIN is a floor so the glow doesn't collapse to a hard edge
// at the slider's own minimum.
const AMBIENT_GLOW_WIDTH_SCALE = 600;
const AMBIENT_GLOW_WIDTH_MIN   = 50;
// Lower base contrast floor + higher exponent (was 0.25 / 2.5) — Simon
// wants fewer, more dramatic peaks ("classic glint/reflection") rather than
// a broad even wash; see GLITTER_BASE_GLOW below for the paired change.
const GLITTER_SPARKLE_CONTRAST = 3.2;
// Floor so the wedge's SHAPE stays visible even where the sparkle noise
// happens to be dim that frame — without this, a narrow/sparse stretch (e.g.
// near the camera, where fewer noise cells fit across the width) could look
// "empty" purely by noise bad luck rather than reading as a deliberate taper.
// Lowered (was 0.25) alongside SPARKLE_CONTRAST's increase above — dimmer
// "cold" shards read as more of a backdrop, so the bright ones pop by
// contrast instead of everything sitting in a similar mid-range ("flat").
const GLITTER_BASE_GLOW = 0.12;
// Per-shard radial falloff (round 17) — a shard's brightest point is now its
// CENTRE, fading toward its edges, like a small soft highlight/blob instead
// of a flat-coloured rectangle. This is the main lever for "flat colour" vs
// "looks like an actual glint": a uniform-brightness rectangle reads as
// paint; a bright centre fading outward reads as light. Floor (not 0) so
// shard edges dim rather than vanish completely — keeps the grid-square
// read from GLITTER_SHARD_SEAM legible alongside the softer glow.
const GLITTER_SHARD_GLOW_FLOOR = 0.35;

// Back-hemisphere glint (round 20, 12 Aug 2026) — Simon correctly pushed
// back on "no glint with the sun behind you is expected": real specular
// reflection needs the surface NORMAL to bisect sun direction and view
// direction (the half-vector H), not the sun to be in front of the camera.
// calculateSunGlitter()'s `inFront` gate hard-zeros anything on the
// camera's far side of the camera->sun ground axis — correct for keeping
// the round-18 "perfect combination" wedge exactly as tuned, but it means
// a hillside that genuinely faces both back toward the camera AND up
// toward a sun behind it never got a chance to glint at all, regardless
// of its actual slope. calculateBackGlint() below is the other half: a
// true Blinn-Phong half-vector test against the REAL per-fragment
// geometric normal (so flat ground stays dark — a mostly-horizontal H
// from a low sun/shallow camera angle just can't satisfy dot(N,H) there;
// only genuinely favourably-tilted slopes light up), with a small per-
// shard random tilt on top so a favourable hillside reads as a scattered
// glint texture rather than one smooth streak — a raw specular test
// against the terrain's actual (smooth, low-frequency) normal field
// would produce exactly that streak, the same failure mode rounds 5-6
// shipped and had to revert for the forward case. Deliberately a
// SEPARATE, additive term, not a merge into calculateSunGlitter() —
// keeps the locked-in forward wedge completely unrisked.
const BACK_GLINT_JITTER    = 0.20;  // per-shard normal tilt strength
const BACK_GLINT_SHININESS = 8.0;   // Blinn-Phong exponent — lower = more forgiving/wider catch
const BACK_GLINT_GATE_WIDTH = 500;  // world units — smooth handoff width from the forward wedge's region

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
export function createTerrainMaterial(
    totalSize: number,
    heightScale: number,
    reflectionState: TerrainReflectionState,
): MeshStandardMaterial {
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
        // Shared live state, not a copy: UI edits update this Vector4 in
        // place, and regenerated materials receive the same current object.
        s.uniforms.reflectionParams = { value: reflectionState.params };
        s.uniforms.sunColor        = { value: new Color(1.0, 0.98, 0.9) };
        s.uniforms.heightScale     = { value: heightScale };
        // Sun glitter reach/width multiplier — live-adjustable via
        // ReflectionControls' "Sun Glitter" sliders, NOT baked into the shader
        // template like the other GLITTER_* constants, because how far the
        // wedge needs to reach before hitting full width depends on the
        // player's actual camera distance, which only live tuning can answer.
        // x = GLITTER_ALONG_FAR (world units, absolute, as before). y used to
        // be GLITTER_WIDTH_FAR (an absolute width) — as of 12 Aug 2026 it's a
        // MULTIPLIER (default 1.0) on top of the auto-computed, sun-height-
        // driven width below, since Simon wants width to track the sun's
        // apparent size automatically, with the slider just for fine
        // adjustment on top of that curve, not overriding it outright.
        s.uniforms.glitterReach    = { value: reflectionState.glitterReach };
        // Smoothed sun height, normalised 0 (lowest/biggest sun) .. 1
        // (highest/smallest) — drives the glitter width's automatic scaling.
        // Pushed live each frame in TerrainGenerator.update().
        s.uniforms.sunHeightT      = { value: 0.5 };
        // Debug isolation mode (11 Aug 2026, round 10) — after several rounds
        // where it was genuinely unclear whether the visible "reflection" was
        // sunGlitter, the ambient weighted-sum terms, or Three's own built-in
        // PBR specular, this renders sunGlitter's raw [0,1] output directly as
        // greyscale (bypassing diffuseColor mixing) AND forces roughness/
        // metalness to fully non-reflective, so Three's built-in specular
        // can't contribute anything either. What you see with this on is
        // ONLY calculateSunGlitter()'s actual output — nothing else.
        s.uniforms.debugShowGlitter = { value: reflectionState.debugShowGlitter ? 1 : 0 };
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
            // normalMatrix transforms object-space normals into VIEW space.
            // Every direction used by the custom reflection code below is in
            // WORLD space (sunWorldPosition/world position/cameraPosition),
            // so comparing normalMatrix*normal with them made the glint rotate
            // incorrectly with the camera. Three's common shader chunk already
            // provides the correct inverse view-direction transform.
            vec3 viewSpaceNormal = normalize(normalMatrix * normal);
            vWorldNormal = inverseTransformDirection(viewSpaceNormal, viewMatrix);
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
            // Was set from JS (s.uniforms.gridSize) but never actually
            // declared here — same class of bug as the time uniform's
            // history above: the JS object had a value, but with no matching
            // GLSL declaration the GPU never received it. Harmless before
            // (nothing read it); calculateSunGlitter()'s shard-grid alignment
            // needs it now (12 Aug 2026).
            uniform float gridSize;
            uniform vec2 glitterReach; // x = along-distance for full width, y = width MULTIPLIER (see below)
            uniform float sunHeightT; // 0 (lowest/biggest sun) .. 1 (highest/smallest) — drives auto width
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
             * Grid-aligned shard sparkle texture — SAME +mapSize/2 half-offset
             * GridSystem.worldToCell() uses (the grid's own origin isn't
             * aligned to world (0,0) otherwise), floored BEFORE hashing so a
             * whole cell shares one value (flat, coherent tiles, not per-
             * pixel noise), with a thin dark seam and a per-shard radial glow
             * on top. Extracted (round 20, 12 Aug 2026) from calculateSunGlitter()
             * so calculateBackGlint() below can reuse the exact same visual
             * texture/grid alignment instead of drifting out of sync with a
             * second copy.
             */
            float shardSparkle(vec2 worldXZ, float mapSize) {
                vec2 gridAligned = (worldXZ + vec2(mapSize * 0.5)) / ${GLITTER_SHARD_SIZE.toFixed(1)};
                vec2 shardCell = floor(gridAligned);
                vec2 shardFrac = fract(gridAligned);
                float n = glitterHash(shardCell);
                float sparkle = pow(n, ${GLITTER_SPARKLE_CONTRAST.toFixed(2)});

                // Distance from this fragment to the nearest cell edge, on
                // whichever axis is closer — 0 exactly on the seam, 0.5 at
                // the shard's centre. Darkening near the seam is what makes
                // adjacent lit shards read as separate tiles instead of
                // fusing into one shapeless patch.
                vec2 edgeDist = min(shardFrac, 1.0 - shardFrac);
                float distToEdge = min(edgeDist.x, edgeDist.y);
                float shardMask = smoothstep(0.0, ${GLITTER_SHARD_SEAM.toFixed(2)}, distToEdge);
                sparkle *= shardMask;

                // Radial glow from the shard's own CENTRE (round 17) — a lit
                // shard is brightest in the middle, fading toward its edges,
                // like a small soft highlight, instead of a flat-coloured
                // rectangle.
                float distFromShardCenter = length(shardFrac - 0.5);
                float shardGlow = 1.0 - smoothstep(0.0, 0.5, distFromShardCenter);
                sparkle *= mix(${GLITTER_SHARD_GLOW_FLOOR.toFixed(2)}, 1.0, shardGlow);
                return sparkle;
            }

            /**
             * How far along, and how far sideways, worldXZ is from the
             * straight ground-plane line running from camXZ through sunXZ.
             * Shared by the glitter wedge below AND calculateReflection()'s
             * ambient sun glow (12 Aug 2026, round 19) — both need the same
             * underlying geometric relationship, just at different scales
             * and with different texturing on top. Extracted so both stay
             * consistent by construction rather than risking two slightly-
             * different copies of the same maths drifting apart.
             */
            void sunAxisInfo(vec2 worldXZ, vec2 sunXZ, vec2 camXZ, out float along, out float lateralOffset) {
                vec2 axis = normalize(sunXZ - camXZ);
                vec2 toFrag = worldXZ - camXZ;
                along = dot(toFrag, axis);
                vec2 perp = toFrag - axis * along;
                lateralOffset = length(perp);
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
            float calculateSunGlitter(vec3 worldPos, vec3 geomNormal, vec3 sunPos, vec3 camPos, float time, float mapSize) {
                float along, lateralOffset;
                sunAxisInfo(worldPos.xz, sunPos.xz, camPos.xz, along, lateralOffset);
                float inFront = step(0.0, along);

                // glitterReach.x (alongFar) is live-adjustable — see the uniform
                // declaration above for why. max() guard: same smoothstep/
                // divide-by-zero gotcha as reflectionParams.z elsewhere in this
                // file if the reach slider ever got dragged down to
                // GLITTER_ALONG_NEAR exactly.
                float t = clamp((along - ${GLITTER_ALONG_NEAR.toFixed(1)}) / max(1.0, glitterReach.x - ${GLITTER_ALONG_NEAR.toFixed(1)}), 0.0, 1.0);
                // Far-end width auto-scales with the sun's apparent size —
                // glitterReach.y is now a MULTIPLIER on this curve, not an
                // absolute width. See GLITTER_WIDTH_AUTO_MIN/MAX/CURVE_POWER
                // above for the data this was fit against.
                float autoWidthFar = mix(
                    ${GLITTER_WIDTH_AUTO_MIN.toFixed(1)},
                    ${GLITTER_WIDTH_AUTO_MAX.toFixed(1)},
                    pow(1.0 - sunHeightT, ${GLITTER_WIDTH_CURVE_POWER.toFixed(2)})
                ) * glitterReach.y;
                float allowedWidth = mix(${GLITTER_WIDTH_NEAR.toFixed(1)}, autoWidthFar, pow(t, ${GLITTER_WIDTH_POWER.toFixed(2)}));
                // Falloff now spans the FULL width (was allowedWidth*0.5 to
                // allowedWidth — a flat, fully-bright inner half then a
                // fade). Simon: "increase the falloff massively... central
                // bright core" — starting the fade at the centre instead of
                // halfway out gives one continuous gradient, brightest at the
                // wedge's own centreline and soft all the way to its edge,
                // rather than a plateau-then-cliff.
                float wedgeFactor = 1.0 - smoothstep(0.0, allowedWidth, lateralOffset);

                // NOT time-animated (12 Aug 2026, round 14) — Simon correctly
                // flagged a periodic re-roll (round 13) as motion with no
                // cause: shards were cycling every couple of seconds even
                // with a fully static camera and sun. shardSparkle() is a
                // pure function of position, no time input at all. It still
                // visibly changes as the camera or sun actually moves,
                // because wedgeFactor/facingSunGate below depend on live
                // camera/sun position and sweep different shards into and
                // out of the wedge — that's legitimate, motivated change.
                float sparkle = shardSparkle(worldPos.xz, mapSize);

                vec3 sunDir = normalize(sunPos - worldPos);
                float facingSunGate = smoothstep(-0.05, 0.05, dot(geomNormal, sunDir));

                // Low-sun brightness boost — see GLINT_LOW_SUN_BOOST_MAX/
                // POWER above. Steeply concentrated near sunHeightT=0 via
                // the high exponent; negligible once the sun is more than
                // modestly elevated.
                float lowSunBoost = mix(1.0, ${GLINT_LOW_SUN_BOOST_MAX.toFixed(2)}, pow(1.0 - sunHeightT, ${GLINT_LOW_SUN_BOOST_POWER.toFixed(2)}));

                return wedgeFactor * mix(${GLITTER_BASE_GLOW.toFixed(2)}, 1.0, sparkle) * facingSunGate * inFront * lowSunBoost;
            }

            /**
             * Back-hemisphere glint (round 20) — see BACK_GLINT_* above for
             * the full reasoning. Real specular reflection needs the LOCAL
             * surface normal to bisect sun direction and view direction (the
             * half-vector H) — it doesn't require the sun to be in front of
             * the camera the way calculateSunGlitter()'s wedge does. This is
             * the other half: a true Blinn-Phong half-vector test against the
             * REAL per-fragment geometric normal, so it only lights up where
             * the actual terrain shape is favourably tilted (flat ground
             * stays dark — a mostly-horizontal H, which is what a low sun and
             * a shallow camera angle produce, just can't satisfy dot(N,H)
             * against a flat normal), with a small per-shard random tilt on
             * top (shardSparkle()'s same grid, different hash offset so the
             * jitter isn't correlated with the sparkle brightness pattern) so
             * a favourable hillside reads as a scattered glint texture, not
             * one smooth streak.
             */
            float calculateBackGlint(vec3 worldPos, vec3 geomNormal, vec3 sunPos, vec3 camPos, float mapSize) {
                vec3 toSun = normalize(sunPos - worldPos);
                vec3 toCam = normalize(camPos - worldPos);

                vec2 gridAligned = (worldPos.xz + vec2(mapSize * 0.5)) / ${GLITTER_SHARD_SIZE.toFixed(1)};
                vec2 shardCell = floor(gridAligned);
                float jitterA = glitterHash(shardCell + vec2(17.0, 91.0)) - 0.5;
                float jitterB = glitterHash(shardCell + vec2(53.0, 29.0)) - 0.5;
                vec3 facetNormal = normalize(geomNormal + vec3(jitterA, 0.0, jitterB) * ${BACK_GLINT_JITTER.toFixed(2)});

                vec3 halfVector = normalize(toSun + toCam);
                float spec = pow(max(dot(facetNormal, halfVector), 0.0), ${BACK_GLINT_SHININESS.toFixed(1)});

                float facingSunGate = smoothstep(-0.05, 0.05, dot(geomNormal, toSun));
                float facingCamGate = smoothstep(-0.05, 0.05, dot(geomNormal, toCam));

                // Only active in the hemisphere calculateSunGlitter's wedge
                // doesn't cover (along < 0, i.e. the camera's far side of the
                // camera->sun axis) — smooth transition, not a hard line, so
                // there's no visible seam where the two effects hand off.
                float along, lateralOffset;
                sunAxisInfo(worldPos.xz, sunPos.xz, camPos.xz, along, lateralOffset);
                float behindGate = 1.0 - smoothstep(-${BACK_GLINT_GATE_WIDTH.toFixed(1)}, 0.0, along);

                float sparkle = shardSparkle(worldPos.xz, mapSize);

                return spec * sparkle * facingSunGate * facingCamGate * behindGate;
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
                float sunGlitter = calculateSunGlitter(vWorldPosition, geomNormal, sunWorldPosition, cameraPosition, time, gridSize);

                // Back-hemisphere glint (round 20) — see calculateBackGlint()
                // above. Covers the region calculateSunGlitter()'s wedge
                // explicitly doesn't (sun behind the camera) via real
                // half-vector specular against the actual terrain slope, so
                // it's zero on flat ground and only lights up favourably-
                // tilted hillsides — not "everything glows twice as much."
                float backGlint = calculateBackGlint(vWorldPosition, geomNormal, sunWorldPosition, cameraPosition, gridSize);

                debugGlitterValue = sunGlitter + backGlint; // for the debug isolation view — see uniform declaration above

                // Shared facing-sun gate (round 19) — applied below to
                // EVERY reflectivity term except sunGlitter (which already
                // has its own internal copy) and panelFactor (a textural
                // detail, not "shine", left alone). Before this, grazing/
                // height shine in particular had NO sun-awareness at all —
                // purely camera-angle-based — so steep terrain (peaks,
                // ridges) could shine even facing directly away from the
                // sun, in its own shadow (Simon, 12 Aug 2026: "facing away
                // from the sun on higher terrain... in theory in the
                // shadow... but I can [see the glint]").
                vec3 fragToSun = normalize(sunWorldPosition - vWorldPosition);
                float facingSunGate = smoothstep(-0.05, 0.05, dot(geomNormal, fragToSun));

                // Was a fixed distance-from-the-west-edge falloff — happened
                // to look sun-aligned only because the sun's orbit always
                // sits to the west, but never actually read the sun's
                // position, so it didn't re-centre as the camera turned
                // (Simon, 12 Aug 2026: "needs to originate in the centre in
                // line with the sun not offset... only visible when I orbit
                // or pan to the sides"). Redesigned around the SAME camera->
                // sun ground-axis technique as the glitter wedge (see
                // sunAxisInfo()) — correctly centred regardless of camera
                // angle, just much wider and untextured (a broad soft glow,
                // not sparkly shards). reflectionParams.z (Position Factor
                // slider) keeps its existing role, now as a width scale
                // instead of a transition width.
                float posAlong, posLateral;
                sunAxisInfo(vWorldPosition.xz, sunWorldPosition.xz, cameraPosition.xz, posAlong, posLateral);
                float positionGlowWidth = max(${AMBIENT_GLOW_WIDTH_MIN.toFixed(1)}, reflectionParams.z * ${AMBIENT_GLOW_WIDTH_SCALE.toFixed(1)});
                float positionFactor = step(0.0, posAlong) * (1.0 - smoothstep(0.0, positionGlowWidth, posLateral));
                positionFactor *= facingSunGate;

                float panelFactor = getPanelFactor();

                float heightFactor = 1.0 - abs(normalizedNormal.y);
                heightFactor = pow(heightFactor, ${ReflectionParameters.HEIGHT_FACTOR_POWER.toFixed(2)});

                float grazingDot = 1.0 - abs(dot(normalizedNormal, normalizedCameraDir));
                float grazingFactor = pow(grazingDot, ${ReflectionParameters.GRAZING_FACTOR_POWER.toFixed(2)});
                // See facingSunGate comment above — this is the fix for
                // glint appearing on shadowed/away-facing steep terrain.
                grazingFactor *= facingSunGate;

                float totalFactor = pow(
                    sunGlitter     * ${ReflectionParameters.SUN_GLITTER_WEIGHT.toFixed(2)} +
                    backGlint      * ${ReflectionParameters.SUN_GLITTER_WEIGHT.toFixed(2)} +
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

        // Emissive contribution — see GLINT_EMISSIVE_INTENSITY above for why
        // this needs to exist at all (diffuseColor alone is scene-light-
        // dependent and was invisible with the sun low). totalEmissiveRadiance
        // is Three's own variable (declared just before this chunk runs,
        // `vec3 totalEmissiveRadiance = emissive;`) — adding to it here is
        // the standard, correct way to contribute a self-lit glow; it's
        // added straight into the final output (outgoingLight), completely
        // bypassing the lit diffuse/specular BRDF pipeline. reflectionColor
        // is still in scope here — same main() function body, declared
        // earlier in the color_fragment chunk above.
        s.fragmentShader = s.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            totalEmissiveRadiance += reflectionColor * ${GLINT_EMISSIVE_INTENSITY.toFixed(2)};`
        );

        s.fragmentShader = s.fragmentShader.replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            // Was mix(reflectionParams.y, 0.1, reflectionStrength) — glossier
            // wherever reflectionStrength (now dominated by sunGlitter) was
            // high. Real bug (12 Aug 2026, round 15): that's EXACTLY the
            // shard-lit area, so it was re-triggering Three's own built-in
            // specular highlight (see REFLECTION_PARAMS' comment in
            // LightingConfig.ts) right on top of the glitter. Being a smooth,
            // continuous, physically-driven highlight — not discretized into
            // shards the way sunGlitter's colour is — it visually overwhelmed
            // the shard pattern entirely: Simon could see it clearly with
            // debug off (which forces roughness/metalness fully non-
            // reflective and so never showed this), but with debug off saw
            // only "the old reflection", not the glitter underneath it.
            // Metalness/Roughness are now honest, fixed sliders — no longer
            // secretly tied to the reflection system. The glitter's shine
            // comes entirely from colour/brightness (diffuseColor mixing
            // below), which IS correctly shard-shaped.
            roughnessFactor = reflectionParams.y;
            if (debugShowGlitter > 0.5) { roughnessFactor = 1.0; }`
        );

        s.fragmentShader = s.fragmentShader.replace(
            '#include <metalnessmap_fragment>',
            `#include <metalnessmap_fragment>
            metalnessFactor = reflectionParams.x;
            if (debugShowGlitter > 0.5) { metalnessFactor = 0.0; }`
        );

        // Debug isolation, take 2 — MUST happen here, not in color_fragment.
        // First attempt overrode diffuseColor.rgb there, but diffuseColor is
        // only the material's ALBEDO INPUT to Three's lighting equations —
        // it still gets multiplied by the scene's actual light intensity
        // (ambient + sunLight) before reaching the screen. In a dark scene
        // (low ambient, dim/low sun) that multiplication can crush even a
        // healthy sunGlitter value down to near-invisible — Simon saw flat
        // black and reasonably read that as "sunGlitter is broken", when it
        // was actually the debug VIEW that was broken. `dithering_fragment`
        // is the last chunk in Three's standard fragment shader — overriding
        // gl_FragColor here happens AFTER all lighting is already resolved,
        // so debugGlitterValue reaches the screen completely unlit and
        // undimmed, exactly as calculateSunGlitter() actually computed it.
        s.fragmentShader = s.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            if (debugShowGlitter > 0.5) {
                gl_FragColor = vec4(vec3(debugGlitterValue), 1.0);
            }`
        );

        (material as any).customShader = s;
    };

    return material;
}
