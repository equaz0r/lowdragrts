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
const GLITTER_FREQUENCY = 0.03;
const GLITTER_SPEED = 0.6;
const GLITTER_ALONG_NEAR = 250;
const GLITTER_ALONG_FAR = 2500;
const GLITTER_WIDTH_NEAR = 70;
const GLITTER_WIDTH_FAR = 1200;
const GLITTER_WIDTH_POWER = 0.8;
const GLITTER_SPARKLE_CONTRAST = 2.5;
const GLITTER_BASE_GLOW = 0.25;

// --- Keep in sync with LightingSystem.ts's updateSunPosition() ---
const SUN_ORBIT_RADIUS = 8000;
const SUN_MAX_ANGLE = 2.6451383319538957;
const SUN_MIN_ANGLE = 3.0978286848490466;
const SUN_MIN_HEIGHT = -0.8, SUN_MAX_HEIGHT = 0.65;
function sunPosForHeight(h) {
    const nh = (h - SUN_MIN_HEIGHT) / (SUN_MAX_HEIGHT - SUN_MIN_HEIGHT);
    const angle = SUN_MIN_ANGLE - (nh * (SUN_MIN_ANGLE - SUN_MAX_ANGLE));
    return [Math.cos(angle) * SUN_ORBIT_RADIUS, Math.sin(angle) * SUN_ORBIT_RADIUS, 0];
}

// --- calculateSunGlitter(), translated 1:1 from the GLSL ---
function calculateSunGlitter(worldPos, geomNormal, sunPos, camPos, time) {
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
    const allowedWidth = mix(GLITTER_WIDTH_NEAR, GLITTER_WIDTH_FAR, Math.pow(t, GLITTER_WIDTH_POWER));
    const wedgeFactor = 1.0 - smoothstep(allowedWidth*0.5, allowedWidth, lateralOffset);

    const cell = [worldPos[0]*GLITTER_FREQUENCY + time*GLITTER_SPEED, worldPos[2]*GLITTER_FREQUENCY + time*GLITTER_SPEED*0.7];
    const n = glitterHash(cell);
    const sparkle = Math.pow(n, GLITTER_SPARKLE_CONTRAST);

    const sunDir = norm3(sub3(sunPos, worldPos));
    const facingSunGate = smoothstep(-0.05, 0.05, dot3(geomNormal, sunDir));

    return wedgeFactor * mix(GLITTER_BASE_GLOW, 1.0, sparkle) * facingSunGate * inFront;
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

function renderScreenAscii(cam, sunPos, times, label, W=70, H=45) {
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
                const v = calculateSunGlitter(worldPos, geomNormal, sunPos, cam.pos, t);
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

const sunPos = sunPosForHeight(-0.79); // matches Simon's "low, big sun" test screenshots
const times = [5, 33, 71, 140, 210, 300, 380];

renderScreenAscii(makeCamera([3200,450,0], [0,150,0], 75, 0.7), sunPos, times, 'Camera aligned with sun azimuth, moderate height');
renderScreenAscii(makeCamera([1800,250,200], [0,120,0], 75, 0.7), sunPos, times, 'Lower/closer camera');
// Off-axis: NOT looking directly at the sun — this is the realistic case
// (players don't perfectly centre the sun) and the one that exposed the
// "reads as misaligned" complaint on 11 Aug 2026. The wedge won't
// perfectly converge on 'S' near the camera (that's real geometry, not a
// bug — see the GLITTER_* comment block in TerrainMaterial.ts) but should
// get close to it and be wide enough that the imprecision isn't obvious.
renderScreenAscii(makeCamera([2000,500,1500], { forward: [-0.8,-0.15,-0.5] }, 75, 0.7), sunPos, times, 'Off-axis camera (not looking directly at the sun)');

console.log('\nExpected: a wedge WIDE near the top (horizon/sun) narrowing toward the bottom (camera),');
console.log('surrounding or close to the marked S (sun\'s true screen position) even off-axis.');
console.log('If it comes out backwards, missing, or a thin line nowhere near S, do not re-guess');
console.log('constants blind — extend this script (more cameras, print the raw along/lateralOffset/');
console.log('wedgeFactor terms) until the bug is understood, the way this file caught real bugs');
console.log('(backwards shape, a Lambertian dimmer misused on a specular effect, and this');
console.log('alignment-vs-width tradeoff) on 11 Aug 2026 — reasoning through the GLSL by hand alone');
console.log('got it wrong three rounds in a row before this script existed.');
