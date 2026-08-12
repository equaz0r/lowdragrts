import { Color, Vector4 } from 'three';

export const LightingParameters = {
    SKY_TOP_COLOR:    new Color(0x1a0640), // deep purple-blue zenith, was pure blue
    SKY_MIDDLE_COLOR: new Color(0x6699ff),
    SKY_BOTTOM_COLOR: new Color(0xff9966),
    SKY_GRADIENT_OFFSET:   400,
    SKY_GRADIENT_EXPONENT: 0.6,

    SUN_GEOMETRY_SIZE: 900,
    SUN_OPACITY:       0.9,
    SUN_LOW_COLOR:     new Color(0xff0033),
    SUN_HIGH_COLOR:    new Color(0xffffee),
    SUN_ORBIT_RADIUS:  8000,
    SUN_MAX_HEIGHT:    0.65,
    SUN_MIN_HEIGHT:    -0.8,
    SUN_BASE_INTENSITY: 1.75, // Simon's hand-tuned scene, 11 Aug 2026
    // Applied ONLY to the DirectionalLight that actually illuminates the
    // terrain (LightingSystem.ts's updateSunPosition, the heightFactor-based
    // assignment — the one that wins each frame). The sun disc's own opacity
    // and the halo intensity do NOT read this — they stay at full
    // SUN_BASE_INTENSITY, so the sun can look exactly as bright in the sky
    // as before while contributing much less light to terrain shading.
    SUN_TERRAIN_LIGHT_SCALE: 0.45,

    SUN_MIN_SCALE:   0.4,
    SUN_MAX_SCALE:   4.0,
    SUN_SCALE_POWER: 0.2,

    SUN_TRANSITION_START:    0.85,
    SUN_TRANSITION_END:      0.7,
    SUN_LOW_DEPTH_THRESHOLD: 0.3,

    // Was deep BLUE at the bottom (0x000066) — bottom half should read as
    // deep dark red at low sun, top half brighter yellowy-orange (echoes the
    // reference image's sun banding).
    SUN_GRADIENT_BOTTOM: new Color(0x5c0010),
    SUN_GRADIENT_MIDDLE: new Color(0xd42200),
    SUN_GRADIENT_TOP:    new Color(0xffb020),

    // Size restored to (near) original — geometric footprint and intensity
    // are independent uniforms (see the halo fragment shader: alpha comes
    // from the plane's own radial falloff, separately scaled by `intensity`).
    // Shrinking BOTH last round to fix bloom bleed was heavy-handed: a big
    // plane at a modest intensity reads as a proper large soft glow without
    // pushing enough HDR energy to bloom hard.
    HALO_SIZE:         5500,
    HALO_INTENSITY:    0.24,
    HALO_FRONT_OFFSET: 50,
    HALO_BACK_OFFSET:  -50,

    // Lowered for genuine blacks — ambient was flattening contrast everywhere
    // regardless of the reflection bug; neon glow needs real dark to read
    // against, not a uniformly-lit grey scene.
    AMBIENT_BASE_INTENSITY:  0.12,
    SUN_INTENSITY_RANGE:     [0.7, 1.0],
    AMBIENT_INTENSITY_RANGE: [0.12, 0.22],

    SUN_HEIGHT_SMOOTH_SPEED: 0.15,
} as const;

export const ReflectionParameters = {
    // x=metalness, y=roughness, z=positionFactor,
    // w=power — the EXPONENT applied to the combined reflection factor in
    // TerrainMaterial.ts's calculateReflection(). Counter-intuitive: HIGHER
    // exponent = MORE selective/rare highlights (pow pulls values < 1 down
    // toward 0); values near 0 make reflection ≈1.0 (max) almost everywhere
    // regardless of angle. "Reflection Power" in the UI slider reads
    // backwards from this at the low end — turning it down maxes reflection
    // out, not off.
    //
    // x/y found and fixed 11 Aug 2026, round 9 — the REAL resolution to the
    // sun-glint saga. These are the BASELINE metalness/roughness — i.e. what
    // the material looks like when reflectionStrength (sunGlitter etc.) is
    // LOW, everywhere outside the glitter wedge. At the old values
    // (metalness 0.61, roughness 0.47) the terrain was still glossy/metallic
    // enough for THREE.JS'S OWN BUILT-IN PBR SPECULAR HIGHLIGHT (from the
    // real sunLight DirectionalLight — Three's standard lighting code,
    // completely separate from anything in TerrainMaterial.ts's custom
    // onBeforeCompile injection) to produce a real, visible, physically-
    // correct-but-off-axis-misaligned highlight ALL BY ITSELF — the exact
    // same "smooth surface -> single misaligned point" issue solved for the
    // CUSTOM sunGlitter term at the very start of this session, except nothing
    // built this session ever touched THIS one, since it's Three's own code,
    // not mine. This was almost certainly the actual "reflection that
    // doesn't track the sun" Simon had been reporting the ENTIRE session —
    // confirmed empirically (not just theorised): setting Roughness to 1.0
    // live made the mystery streak disappear.
    //
    // Round 9's fix (raise baseline roughness/lower baseline metalness) used
    // mix(baseline, 0.1, reflectionStrength) so the wedge area could still
    // get glossy — but round 15 found that mixing was ITSELF the next bug:
    // wherever reflectionStrength climbs high (the shard-lit glitter area),
    // roughness dipped low again, RE-triggering Three's built-in specular
    // right on top of the glitter — a smooth, continuous highlight (not
    // discretized into shards) that visually overwhelmed the shard colour
    // pattern entirely (Simon: "I can only see the old reflection, not the
    // glitter"). x/y are now READ DIRECTLY as fixed material properties in
    // TerrainMaterial.ts — no longer modulated by reflectionStrength at all.
    // All of the glitter's shine comes from colour/brightness (diffuseColor
    // mixing) now, which correctly follows the shard pattern; nothing is
    // left to reactivate Three's competing built-in highlight. These two
    // values are just the plain Metalness/Roughness slider defaults now,
    // not a "baseline for an ambient state" — tune for overall floor
    // glossiness, independent of the glitter effect entirely.
    REFLECTION_PARAMS: new Vector4(0.1, 0.88, 0.30, 0.90),
    SUN_INTENSITY:     0.5,

    // VIEW_FACTOR_WEIGHT/SUN_FACTOR_WEIGHT/SUN_FACTOR_POWER/VIEW_FACTOR_POWER
    // (the old physically-based N·L / reflect() specular terms against a
    // SMOOTH normal) and SUN_GLINT_WEIGHT/SHARPNESS/SUN_FACING_GATE_POWER
    // (the screen-space "fake tracking" hack that replaced them) are BOTH
    // gone — replaced by SUN_GLITTER_WEIGHT below (11 Aug 2026). Neither
    // earlier approach could produce what real sun glitter on a wavy surface
    // actually looks like: a wide, camera-converging wedge, not a single
    // aligned point. See calculateSunGlitter() in TerrainMaterial.ts and the
    // plan doc for the full reasoning (Simon's hand-annotated screenshot is
    // what settled this).
    //
    // Cut hard (11 Aug 2026, round 8) — these three are the "ambient floor
    // shine": NONE of them reference the sun's position at all (verified by
    // reading the shader, not assumed). POSITION_FACTOR is a hardcoded
    // "west is shinier" gradient that happens to coincide with the sun's
    // fixed west orbit but doesn't read its actual height; GRAZING_FACTOR is
    // purely camera-viewing-angle-vs-terrain-slope, so it visibly shifts as
    // the camera orbits in a way that's easy to mistake for sun-tracking
    // when it isn't. At their old weights (0.15/0.08/0.32) these were
    // routinely OUTSHINING sunGlitter (weight 1.1 but a low typical value —
    // see GLITTER_BASE_GLOW) — Simon had been reacting to THIS the whole
    // multi-round sun-glint saga, not the sun-tracking term being iterated
    // on. Cut ~4-5x so they read as a subtle base sheen, not the dominant
    // visible "reflection" — sunGlitter should now clearly read as the
    // dominant, obviously sun-tracking highlight.
    POSITION_FACTOR_WEIGHT: 0.04,
    PANEL_FACTOR_WEIGHT:    0.02,
    GRAZING_FACTOR_WEIGHT:  0.06,

    // Sun glitter (real per-fragment Blinn-Phong specular against a noisy
    // normal — see calculateSunGlitter() in TerrainMaterial.ts). This is the
    // slot in the weighted sum, same role as its three siblings above; the
    // noise's own shape (frequency/amplitude/shininess) lives as local
    // constants in TerrainMaterial.ts, same pattern as the sea-shimmer
    // constants. Untested number — first pass, expect to retune live.
    SUN_GLITTER_WEIGHT: 1.1,

    HEIGHT_FACTOR_POWER:  0.3,
    GRAZING_FACTOR_POWER: 1.2,

    MIN_REFLECTION:    0.05,
    // Was 1.2 — GLSL mix() doesn't clamp its blend factor, so anything over
    // 1.0 here overshoots past the reflection colour itself (extrapolation,
    // not blending), which was blowing out brightness independent of bloom.
    REFLECTION_BLEND:  0.85,

    WEST_FALLOFF_START:  -4000,
    WEST_FALLOFF_LENGTH:  8000,
} as const;
