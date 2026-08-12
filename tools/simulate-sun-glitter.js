#!/usr/bin/env node
/**
 * Standalone numeric simulation of TerrainMaterial.ts's calculateSunGlitter()
 * — prints an ASCII preview of the glitter wedge's SHAPE as seen from the
 * camera, without needing the browser.
 *
 * Why this exists: two earlier attempts at this effect shipped on pure
 * hand-reasoning about the shader math and were both wrong in ways that
 * weren't obvious from the formulas alone (see CLAUDE.md's Reflection
 * shader tuning notes, 11 Aug 2026). This script replicates the actual
 * GLSL logic in JS and ray-casts it through a real perspective camera the
 * same way a fragment shader samples per-pixel, so shape bugs (wedge
 * pointing the wrong way, envelope invisible off-frustum, a brightness
 * gate silently crushing the whole effect) show up here BEFORE shipping,
 * not after another round of "still doesn't look right".
 *
 * Run: node tools/simulate-sun-glitter.js
 * Keep the GLITTER_* constants below in sync with TerrainMaterial.ts if you
 * change them there — this is a standalone check, not wired to the build.
 */

function fract(x) { return x - Math.floor(x); }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function dot2(a, b) { return a[0]*b[0] + a[1]*b[1]; }
function dot3(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function sub3(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function add3(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function scale3(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
function norm3(a) { const m = Math.sqrt(dot3(a,a)); return m > 1e-9 ? [a[0]/m, a[1]/m, a[2]/m] : [0,0,0]; }
function cross3(a,b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function mix(a,b,t) { return a + (b-a)*t; }
function smoothstep(e0,e1,x) { const t = clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); }
function glitterHash(p) { return fract(Math.sin(dot2(p, [127.1, 311.7])) * 43758.5453); }

// --- Keep in sync with TerrainMaterial.ts ---
// ALONG_FAR/WIDTH_FAR are now the `glitterReach` uniform's INITIAL values
// (live-adjustable via ReflectionControls' "Sun Glitter" sliders in the
// real game) — override them here if you're simulating a specific slider
// position rather than the defaults.
// --- Keep in sync with GridParameters in src/engine/config/TerrainConfig.ts ---
const MAP_SIZE = 8000;         // GridParameters.TOTAL_SIZE
const GLITTER_SHARD_SIZE = 64; // GridParameters.CELL_SIZE — shards snap to the real grid now
const GLITTER_ALONG_NEAR = 250;
const GLITTER_ALONG_FAR = 2500;
const GLITTER_WIDTH_NEAR = 70;
// Round 17 (12 Aug 2026) — far-end width auto-scales with sun height (fit
// against Simon's example points, see TerrainMaterial.ts for the full
// derivation). WIDTH_MULT simulates the "Glitter Width x" slider (1.0 =
// unmodified curve).
const GLITTER_WIDTH_AUTO_MIN = 250;
const GLITTER_WIDTH_AUTO_MAX = 3000;
const GLITTER_WIDTH_CURVE_POWER = 1.25;
const GLITTER_WIDTH_MULT = 1.0;
const GLITTER_WIDTH_POWER = 0.8;
const GLITTER_SPARKLE_CONTRAST = 3.2;
const GLITTER_SHARD_SEAM = 0.06;
const GLITTER_BASE_GLOW = 0.12;
const GLITTER_SHARD_GLOW_FLOOR = 0.35;
const GLINT_LOW_SUN_BOOST_MAX = 2.0;
const GLINT_LOW_SUN_BOOST_POWER = 6.0;

// Round 20 (12 Aug 2026) — back-hemisphere glint, see TerrainMaterial.ts's
// BACK_GLINT_* comment for the full reasoning.
const BACK_GLINT_JITTER = 0.20;
const BACK_GLINT_SHININESS = 8.0;
const BACK_GLINT_GATE_WIDTH = 500;

// --- Keep in sync with LightingSystem.ts's updateSunPosition() ---
const SUN_ORBIT_RADIUS = 8000;
const SUN_MAX_ANGLE = 2.6451383319538957;
const SUN_MIN_ANGLE = 3.0978286848490466;
const SUN_MIN_HEIGHT = -0.8, SUN_MAX_HEIGHT = 0.65;
function sunHeightNormalized(h) { return (h - SUN_MIN_HEIGHT) / (SUN_MAX_HEIGHT - SUN_MIN_HEIGHT); }
function sunPosForHeight(h) {
    const nh = sunHeightNormalized(h);
    const angle = SUN_MIN_ANGLE - (nh * (SUN_MIN_ANGLE - SUN_MAX_ANGLE));
    return [Math.cos(angle) * SUN_ORBIT_RADIUS, Math.sin(angle) * SUN_ORBIT_RADIUS, 0];
}

// --- calculateSunGlitter(), translated 1:1 from the GLSL ---
function calculateSunGlitter(worldPos, geomNormal, sunPos, camPos, time, sunHeightT) {
    const camXZ = [camPos[0], camPos[2]];
    const sunXZ = [sunPos[0], sunPos[2]];
    const fragXZ = [worldPos[0], worldPos[2]];
    let axis = [sunXZ[0]-camXZ[0], sunXZ[1]-camXZ[1]];
    const axisLen = Math.hypot(axis[0], axis[1]);
    axis = [axis[0]/axisLen, axis[1]/axisLen];
    const toFrag = [fragXZ[0]-camXZ[0], fragXZ[1]-camXZ[1]];
    const along = toFrag[0]*axis[0] + toFrag[1]*axis[1];
    const inFront = along >= 0 ? 1 : 0;

    const perp = [toFrag[0]-axis[0]*along, toFrag[1]-axis[1]*along];
    const lateralOffset = Math.hypot(perp[0], perp[1]);

    const t = clamp((along - GLITTER_ALONG_NEAR) / (GLITTER_ALONG_FAR - GLITTER_ALONG_NEAR), 0, 1);
    // Far-end width auto-scales with the sun's apparent size (round 17).
    const autoWidthFar = mix(GLITTER_WIDTH_AUTO_MIN, GLITTER_WIDTH_AUTO_MAX, Math.pow(1 - sunHeightT, GLITTER_WIDTH_CURVE_POWER)) * GLITTER_WIDTH_MULT;
    const allowedWidth = mix(GLITTER_WIDTH_NEAR, autoWidthFar, Math.pow(t, GLITTER_WIDTH_POWER));
    // Falloff spans the FULL width now (was allowedWidth*0.5 to
    // allowedWidth) — one continuous gradient, brightest at the centreline.
    const wedgeFactor = 1.0 - smoothstep(0, allowedWidth, lateralOffset);

    // Grid-aligned cell (12 Aug 2026) — snaps to the exact same cells the
    // visible neon grid draws (GridSystem.worldToCell()'s +mapSize/2 half-
    // offset), not an arbitrary unrelated size. NOT time-animated (round
    // 14) — a quantized-time re-roll fixed grid alignment in round 13 but
    // introduced motion with no cause (shards cycling on a fully static
    // camera/sun). Brightness is a pure function of position now; it still
    // changes correctly when the camera/sun move, since wedgeFactor/
    // facingSunGate below depend on live camera/sun position.
    const gridAligned = [(worldPos[0] + MAP_SIZE*0.5) / GLITTER_SHARD_SIZE, (worldPos[2] + MAP_SIZE*0.5) / GLITTER_SHARD_SIZE];
    const shardCell = [Math.floor(gridAligned[0]), Math.floor(gridAligned[1])];
    const shardFrac = [gridAligned[0]-shardCell[0], gridAligned[1]-shardCell[1]];
    const n = glitterHash(shardCell);
    let sparkle = Math.pow(n, GLITTER_SPARKLE_CONTRAST);
    const edgeDist = [Math.min(shardFrac[0], 1-shardFrac[0]), Math.min(shardFrac[1], 1-shardFrac[1])];
    const distToEdge = Math.min(edgeDist[0], edgeDist[1]);
    const shardMask = smoothstep(0, GLITTER_SHARD_SEAM, distToEdge);
    sparkle *= shardMask;

    // Radial glow from the shard's own centre (round 17) — brightest in the
    // middle, fading toward its edges, like a small soft highlight.
    const distFromShardCenter = Math.hypot(shardFrac[0]-0.5, shardFrac[1]-0.5);
    const shardGlow = 1.0 - smoothstep(0, 0.5, distFromShardCenter);
    sparkle *= mix(GLITTER_SHARD_GLOW_FLOOR, 1.0, shardGlow);

    const sunDir = norm3(sub3(sunPos, worldPos));
    const facingSunGate = smoothstep(-0.05, 0.05, dot3(geomNormal, sunDir));

    const lowSunBoost = mix(1.0, GLINT_LOW_SUN_BOOST_MAX, Math.pow(1.0 - sunHeightT, GLINT_LOW_SUN_BOOST_POWER));
    return wedgeFactor * mix(GLITTER_BASE_GLOW, 1.0, sparkle) * facingSunGate * inFront * lowSunBoost;
}

// Shared shard-texture helper, matching TerrainMaterial.ts's extracted
// shardSparkle() (round 20).
function shardSparkle(worldXZ, mapSize) {
    const gridAligned = [(worldXZ[0] + mapSize*0.5) / GLITTER_SHARD_SIZE, (worldXZ[1] + mapSize*0.5) / GLITTER_SHARD_SIZE];
    const shardCell = [Math.floor(gridAligned[0]), Math.floor(gridAligned[1])];
    const shardFrac = [gridAligned[0]-shardCell[0], gridAligned[1]-shardCell[1]];
    const n = glitterHash(shardCell);
    let sparkle = Math.pow(n, GLITTER_SPARKLE_CONTRAST);
    const edgeDist = [Math.min(shardFrac[0], 1-shardFrac[0]), Math.min(shardFrac[1], 1-shardFrac[1])];
    const distToEdge = Math.min(edgeDist[0], edgeDist[1]);
    const shardMask = smoothstep(0, GLITTER_SHARD_SEAM, distToEdge);
    sparkle *= shardMask;
    const distFromShardCenter = Math.hypot(shardFrac[0]-0.5, shardFrac[1]-0.5);
    const shardGlow = 1.0 - smoothstep(0, 0.5, distFromShardCenter);
    sparkle *= mix(GLITTER_SHARD_GLOW_FLOOR, 1.0, shardGlow);
    return sparkle;
}

// --- calculateBackGlint(), translated 1:1 from the GLSL (round 20) ---
// Real specular reflection needs the LOCAL SURFACE NORMAL to bisect sun
// direction and view direction (the half-vector H) — it doesn't require
// the sun to be in front of the camera the way calculateSunGlitter()'s
// wedge does. Simon correctly called out that a slope facing both back
// toward the camera and up toward a sun behind it should still glint.
function calculateBackGlint(worldPos, geomNormal, sunPos, camPos, mapSize) {
    const toSun = norm3(sub3(sunPos, worldPos));
    const toCam = norm3(sub3(camPos, worldPos));

    const gridAligned = [(worldPos[0] + mapSize*0.5) / GLITTER_SHARD_SIZE, (worldPos[2] + mapSize*0.5) / GLITTER_SHARD_SIZE];
    const shardCell = [Math.floor(gridAligned[0]), Math.floor(gridAligned[1])];
    const jitterA = glitterHash([shardCell[0]+17.0, shardCell[1]+91.0]) - 0.5;
    const jitterB = glitterHash([shardCell[0]+53.0, shardCell[1]+29.0]) - 0.5;
    const facetNormal = norm3(add3(geomNormal, scale3([jitterA, 0.0, jitterB], BACK_GLINT_JITTER)));

    const halfVector = norm3(add3(toSun, toCam));
    const spec = Math.pow(Math.max(dot3(facetNormal, halfVector), 0.0), BACK_GLINT_SHININESS);

    const facingSunGate = smoothstep(-0.05, 0.05, dot3(geomNormal, toSun));
    const facingCamGate = smoothstep(-0.05, 0.05, dot3(geomNormal, toCam));

    const camXZ = [camPos[0], camPos[2]];
    const sunXZ = [sunPos[0], sunPos[2]];
    const fragXZ = [worldPos[0], worldPos[2]];
    let axis = [sunXZ[0]-camXZ[0], sunXZ[1]-camXZ[1]];
    const axisLen = Math.hypot(axis[0], axis[1]);
    axis = [axis[0]/axisLen, axis[1]/axisLen];
    const toFrag = [fragXZ[0]-camXZ[0], fragXZ[1]-camXZ[1]];
    const along = toFrag[0]*axis[0] + toFrag[1]*axis[1];
    const behindGate = 1.0 - smoothstep(-BACK_GLINT_GATE_WIDTH, 0.0, along);

    const sparkle = shardSparkle([worldPos[0], worldPos[2]], mapSize);

    return spec * sparkle * facingSunGate * facingCamGate * behindGate;
}

// --- Perspective camera + screen-space raycast to the flat ground plane ---
// `look` may be a lookAt target (camera assumed aimed at it) OR, for testing
// OFF-AXIS cameras that aren't looking directly at the sun, pass an explicit
// forward vector via { forward: [x,y,z] } instead.
function makeCamera(pos, look, fovDeg, aspect) {
    const forward = Array.isArray(look) ? norm3(sub3(look, pos)) : norm3(look.forward);
    const right = norm3(cross3(forward, [0,1,0]));
    const up = norm3(cross3(right, forward));
    const tanHalfFov = Math.tan(fovDeg * Math.PI/180/2);
    return { pos, forward, right, up, tanHalfFov, aspect,
        rayDir(sx, sy) {
            return norm3(add3(forward, add3(scale3(right, sx*tanHalfFov*aspect), scale3(up, sy*tanHalfFov))));
        },
        // Where does a given world point land on screen? Used to mark the
        // sun's TRUE screen position so misalignment is visible directly,
        // not just inferred.
        project(worldPos) {
            const rel = sub3(worldPos, pos);
            const z = dot3(rel, forward);
            if (z <= 0.01) return null;
            const sx = (dot3(rel, right)/z)/(tanHalfFov*aspect);
            const sy = (dot3(rel, up)/z)/tanHalfFov;
            return { sx, sy };
        }
    };
}

function renderScreenAscii(cam, sunPos, times, label, sunHeightT=0.5, W=70, H=45) {
    const screen = Array.from({length:H}, () => new Array(W).fill(' '));
    const geomNormal = [0,1,0]; // flat ground — the stress-test case (no slope variety to help)
    for (let py = 0; py < H; py++) {
        const sy = 1 - (py/(H-1))*2;
        for (let px = 0; px < W; px++) {
            const sx = (px/(W-1))*2 - 1;
            const dir = cam.rayDir(sx, sy);
            if (dir[1] >= -0.001) continue;
            const tHit = -cam.pos[1] / dir[1];
            if (tHit <= 0) continue;
            const worldPos = add3(cam.pos, scale3(dir, tHit));
            if (Math.hypot(worldPos[0], worldPos[2]) > 7000) continue;
            let maxVal = 0;
            for (const t of times) {
                const v = calculateSunGlitter(worldPos, geomNormal, sunPos, cam.pos, t, sunHeightT);
                if (v > maxVal) maxVal = v;
            }
            screen[py][px] = maxVal > 0.6 ? '#' : (maxVal > 0.25 ? '+' : (maxVal > 0.05 ? '.' : ' '));
        }
    }
    // Mark the sun's true screen position with 'S' — the wedge should
    // visually surround/point at it, especially for off-axis cameras.
    const sunProj = cam.project(sunPos);
    if (sunProj) {
        const spx = Math.round((sunProj.sx+1)/2*(W-1));
        const spy = Math.round((1-sunProj.sy)/2*(H-1));
        if (spy >= 0 && spy < H && spx >= 0 && spx < W) screen[spy][spx] = 'S';
    }
    console.log(`\n=== ${label} === (S = sun's true screen position; top=horizon, bottom=near camera)`);
    for (const row of screen) console.log(row.join(''));
}

const testSunHeight = -0.79; // matches Simon's "low, big sun" test screenshots
const sunPos = sunPosForHeight(testSunHeight);
const testSunHeightT = sunHeightNormalized(testSunHeight);
const times = [5, 33, 71, 140, 210, 300, 380];

renderScreenAscii(makeCamera([3200,450,0], [0,150,0], 75, 0.7), sunPos, times, 'Camera aligned with sun azimuth, moderate height', testSunHeightT);
renderScreenAscii(makeCamera([1800,250,200], [0,120,0], 75, 0.7), sunPos, times, 'Lower/closer camera', testSunHeightT);
// Off-axis: NOT looking directly at the sun — this is the realistic case
// (players don't perfectly centre the sun) and the one that exposed the
// "reads as misaligned" complaint on 11 Aug 2026. The wedge won't
// perfectly converge on 'S' near the camera (that's real geometry, not a
// bug — see the GLITTER_* comment block in TerrainMaterial.ts) but should
// get close to it and be wide enough that the imprecision isn't obvious.
renderScreenAscii(makeCamera([2000,500,1500], { forward: [-0.8,-0.15,-0.5] }, 75, 0.7), sunPos, times, 'Off-axis camera (not looking directly at the sun)', testSunHeightT);

// Auto width-vs-sun-height curve check (round 17) — verify the fitted curve
// against Simon's own example points before trusting it.
console.log('\n=== Auto width curve check (Simon\'s example points) ===');
for (const [h, target] of [[-0.80,3000],[-0.05,1250],[0.28,850],[0.65,250]]) {
    const t = sunHeightNormalized(h);
    const computed = mix(GLITTER_WIDTH_AUTO_MIN, GLITTER_WIDTH_AUTO_MAX, Math.pow(1-t, GLITTER_WIDTH_CURVE_POWER));
    console.log(`  height=${h.toFixed(2)} target=${target} computed=${computed.toFixed(0)}`);
}

console.log('\nExpected: a wedge WIDE near the top (horizon/sun) narrowing toward the bottom (camera),');
console.log('surrounding or close to the marked S (sun\'s true screen position) even off-axis.');
console.log('If it comes out backwards, missing, or a thin line nowhere near S, do not re-guess');
console.log('constants blind — extend this script (more cameras, print the raw along/lateralOffset/');
console.log('wedgeFactor terms) until the bug is understood, the way this file caught real bugs');
console.log('(backwards shape, a Lambertian dimmer misused on a specular effect, and this');
console.log('alignment-vs-width tradeoff) on 11 Aug 2026 — reasoning through the GLSL by hand alone');
console.log('got it wrong three rounds in a row before this script existed.');

// --- Back-glint check (round 20, 12 Aug 2026) ---
// calculateSunGlitter()'s wedge is gated to the camera->sun forward
// hemisphere (`inFront`). Simon correctly pushed back on "no glint with
// the sun behind you is expected" — a slope that faces both back toward
// the camera and up toward a sun behind it should still glint by real
// half-vector optics. calculateBackGlint() is the other half. Checks
// below, using a real ray-cast camera the same way the wedge tests above
// do (not just isolated dot-product arithmetic):
//   1. Flat ground, sun behind camera: should stay near-zero everywhere
//      (a mostly-horizontal half-vector can't satisfy dot(N,H) against a
//      flat N) — confirms this doesn't turn into "everything glows".
//   2. Undulating slopes (alternating east/west-facing), sun behind
//      camera: favourable (sun-and-camera-facing) slopes should light up
//      with a SCATTERED texture (multiple '#'/'+' cells, not one single
//      pixel) — confirms the per-shard jitter actually produces a spread,
//      not the single-streak failure mode rounds 5-6 shipped and reverted.
//   3. Sun in FRONT of camera (calculateSunGlitter()'s own territory):
//      back-glint should stay near-zero — confirms behindGate correctly
//      hands off to the forward wedge without a bright double-lit seam.
console.log('\n=== Back-glint check (sun behind camera) ===');
const backSunHeight = -0.30;
const backSunPos = sunPosForHeight(backSunHeight);
console.log(`Sun position for height ${backSunHeight}: [${backSunPos.map(v=>v.toFixed(0)).join(', ')}] (large negative X = west)`);

function renderBackGlintAscii(cam, sunPos, label, useSlopes, W=70, H=45) {
    const screen = Array.from({length:H}, () => new Array(W).fill(' '));
    let litCount = 0, groundCount = 0, maxVal = 0;
    for (let py = 0; py < H; py++) {
        const sy = 1 - (py/(H-1))*2;
        for (let px = 0; px < W; px++) {
            const sx = (px/(W-1))*2 - 1;
            const dir = cam.rayDir(sx, sy);
            if (dir[1] >= -0.001) continue;
            const tHit = -cam.pos[1] / dir[1];
            if (tHit <= 0) continue;
            const worldPos = add3(cam.pos, scale3(dir, tHit));
            if (Math.hypot(worldPos[0], worldPos[2]) > 7000) continue;
            groundCount++;
            // Synthetic undulating slope field (alternating east/west-facing
            // ridges) so both favourable and unfavourable slopes are on
            // screen at once, like a real hillside would present. Flat
            // ([0,1,0]) for the "should stay dark" control case.
            // Amplitude 1.2 ~ up to 50 degrees off vertical at the steepest
            // point of each ridge — realistic for this game's mountain
            // slopes (height up to 1400 over 64-unit grid cells produces
            // local slopes well past 45 degrees), not an exaggeration. A
            // quick standalone check (12 Aug 2026) found the half-vector
            // for a low-behind sun is itself fairly close to horizontal, so
            // dot(N,H) only gets strong against genuinely steep terrain —
            // 0.5 (~26 degrees) tested here first and came back essentially
            // dark, which is why this is 1.2, not a smaller "safe" number.
            const geomNormal = useSlopes ? norm3([1.2 * Math.sin(worldPos[0] * 0.0015), 1, 0]) : [0,1,0];
            const back = calculateBackGlint(worldPos, geomNormal, sunPos, cam.pos, MAP_SIZE);
            if (back > maxVal) maxVal = back;
            if (back > 0.05) litCount++;
            screen[py][px] = back > 0.5 ? '#' : (back > 0.2 ? '+' : (back > 0.05 ? '.' : ' '));
        }
    }
    console.log(`\n--- ${label} ---`);
    for (const row of screen) console.log(row.join(''));
    console.log(`  lit (>0.05): ${litCount}/${groundCount} ground fragments, peak value ${maxVal.toFixed(2)}`);
    return { litCount, groundCount, maxVal };
}

// Camera looking EAST (+X), sun is west (large negative X) -> sun is
// squarely behind the camera. This is exactly the configuration Simon
// reported: "if I turn the camera orbit so the back of the camera is to
// the sun, I don't see the glint at all."
const backCam = makeCamera([-500, 400, 0], { forward: [1, -0.12, 0] }, 75, 0.7);
const flatResult  = renderBackGlintAscii(backCam, backSunPos, 'Flat ground, sun behind camera (should stay ~empty)', false);
const slopeResult = renderBackGlintAscii(backCam, backSunPos, 'Undulating slopes, sun behind camera (favourable slopes should light up, scattered)', true);

// Sanity: sun in FRONT of the camera instead — calculateSunGlitter()'s own
// territory. backGlint should contribute ~nothing here.
const forwardCam = makeCamera([500, 400, 0], { forward: [-1, -0.12, 0] }, 75, 0.7);
const forwardResult = renderBackGlintAscii(forwardCam, backSunPos, 'Sun IN FRONT of camera (backGlint should stay ~empty, this is the wedge\'s job)', true);

console.log('\n=== Back-glint PASS/FAIL summary ===');
const checks = [
    ['Flat ground stays dark (litCount ~0)', flatResult.litCount === 0],
    ['Sloped terrain lights up somewhere (litCount > 0)', slopeResult.litCount > 0],
    ['Sloped terrain is a SPREAD, not one pixel (litCount > 5)', slopeResult.litCount > 5],
    ['Forward-of-camera sun stays ~dark (litCount < 5)', forwardResult.litCount < 5],
];
let allPass = true;
for (const [desc, pass] of checks) {
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${desc}`);
    if (!pass) allPass = false;
}
console.log(allPass
    ? '\nAll back-glint checks passed — shape looks like a genuine scattered glint on favourable slopes, not a single pixel or a flat-ground wash.'
    : '\nSOME BACK-GLINT CHECKS FAILED — do not ship without understanding why (see the failing rows above).');
