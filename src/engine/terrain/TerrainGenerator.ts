import {
    BufferGeometry,
    Float32BufferAttribute,
    Mesh,
    Color,
    PerspectiveCamera,
    Material,
    Scene,
    BufferAttribute,
} from 'three';
import { GridSystem } from './GridSystem';
import { HeightMap } from './HeightMap';
import { createTerrainMaterial } from './TerrainMaterial';
import { createEdgeMaterial, EdgeUniforms } from './EdgeMaterial';
import { createTerrainGridMesh, BuildableCells } from './TerrainGrid';
import { NoiseSampler } from '../utils/NoiseSampler';
import { TerrainParameters } from '../config/TerrainConfig';
import { ReflectionControls } from '../ui/ReflectionControls';
import { LightingSystem } from './LightingSystem';
import { BufferPool } from '../utils/BufferPool';
import { Rng } from '../../sim/core/Rng';

export interface TerrainConfig {
    heightScale:   number;
    persistence:   number;      // fractal gain — roughness of both layers
    basePeakBlend: number;      // 0 = all peaks, 1 = all base rolling hills
    baseFrequency: number;      // scale of rolling hills (lower = bigger features)
    peakFrequency: number;      // scale of mountain ridges
    warpAmplitude: number;      // how far coordinates are displaced (0 = off)
    warpFrequency: number;      // scale of the warp itself
    peakThreshold: number;      // 0..1 — values below this are flat (fewer peaks = higher)
    baseOctaves:   number;
    peakOctaves:   number;
    valleyEnabled: boolean;
    valleyWidth:   number;      // fraction of total map width (0.05 – 0.5)
    valleyDepth:   number;      // 0 = no effect, 1 = flat floor
    plateauEnabled: boolean;
    plateauCount:   number;     // how many flat build-sites to place
    plateauRadius:  number;     // world units — flat core + falloff band
    plateauEdge:    number;     // 0..1 — higher = sharper cliff-like edge, lower = soft mound
    regionMaskEnabled:      boolean;
    regionMaskFrequency:    number;  // lower = bigger, fewer flatland/mountain zones
    regionFlatAmplitude:    number;  // 0..1 — how much base-hill variation survives in flatland (low = smooth plateau)
    regionMountainAmplitude: number; // typically ~1 — hill+peak amplitude inside mountain zones
}

/** A flattened build-site produced by plateau carving. World-space centre + the
 *  height the plateau sits at (sampled from the base terrain, so it reads as a
 *  natural bench rather than an artificially inserted disc). */
export interface PlateauSite {
    x: number;
    z: number;
    radius: number;
    height: number;
}

/** Named terrain presets — lock in a known-good look instead of tuning from scratch. */
export const TerrainPresets: Record<string, TerrainConfig> = {
    PRESET_DRAMATIC: {
        heightScale: 2000, persistence: 0.65, basePeakBlend: 0.35,
        baseFrequency: 0.00035, peakFrequency: 0.0009,
        warpAmplitude: 500, warpFrequency: 0.00018,
        peakThreshold: 0.32, baseOctaves: 5, peakOctaves: 7,
        valleyEnabled: true, valleyWidth: 0.14, valleyDepth: 0.85,
        plateauEnabled: false, plateauCount: 0, plateauRadius: 500, plateauEdge: 0.6,
        // Stark contrast: very flat lowlands, exaggerated mountains — dramatic by name.
        regionMaskEnabled: true, regionMaskFrequency: 0.00004,
        regionFlatAmplitude: 0.10, regionMountainAmplitude: 1.15,
    },
    PRESET_ROLLING: {
        heightScale: 700, persistence: 0.35, basePeakBlend: 0.85,
        baseFrequency: 0.0005, peakFrequency: 0.0008,
        warpAmplitude: 200, warpFrequency: 0.00022,
        peakThreshold: 0.55, baseOctaves: 4, peakOctaves: 5,
        valleyEnabled: false, valleyWidth: 0.18, valleyDepth: 0.5,
        plateauEnabled: false, plateauCount: 0, plateauRadius: 500, plateauEdge: 0.6,
        // Off — this preset is specifically uniform gentle hills everywhere,
        // no stark flat/mountain zoning.
        regionMaskEnabled: false, regionMaskFrequency: 0.00004,
        regionFlatAmplitude: 0.5, regionMountainAmplitude: 1.0,
    },
    PRESET_BATTLEFIELD: {
        heightScale: 1100, persistence: 0.45, basePeakBlend: 0.6,
        baseFrequency: 0.0004, peakFrequency: 0.0008,
        warpAmplitude: 300, warpFrequency: 0.0002,
        peakThreshold: 0.45, baseOctaves: 5, peakOctaves: 6,
        valleyEnabled: true, valleyWidth: 0.16, valleyDepth: 0.5,
        plateauEnabled: true, plateauCount: 4, plateauRadius: 550, plateauEdge: 0.65,
        // Moderate flat expanses (good open ground alongside the plateau
        // build-sites) with real mountains for tactical cover/chokepoints.
        regionMaskEnabled: true, regionMaskFrequency: 0.00005,
        regionFlatAmplitude: 0.2, regionMountainAmplitude: 1.0,
    },
};

/**
 * The one sanctioned `Math.random()` call site in the codebase (the sim layer
 * bans it outright — see src/sim/core/Rng.ts). Everything downstream of a
 * chosen seed — noise sampling, plateau site selection — is deterministic.
 */
function newRandomSeed(): number {
    return Math.random() * 2147483647 | 0;
}

export class TerrainGenerator {
    // Simon's preferred scene (11 Aug 2026, via full JSON export this time —
    // no unreadable-slider guessing needed). Turns out to be exactly
    // PRESET_DRAMATIC's values, so reference it directly rather than
    // duplicating 20 fields — if that preset changes, this default moves
    // with it, which is the right behaviour (both ARE "dramatic").
    public config: TerrainConfig = { ...TerrainPresets.PRESET_DRAMATIC };

    private readonly gridSystem: GridSystem;
    private readonly camera: PerspectiveCamera;
    private readonly scene: Scene;
    private readonly lightingSystem: LightingSystem;
    private material: Material | null = null;
    private terrainMesh: Mesh | null = null;
    private seed: number;
    private bufferPool: BufferPool;
    private currentBuffers: {
        vertex: Float32Array | null;
        color:  Float32Array | null;
        uv:     Float32Array | null;
        index:  Uint32Array  | null;
        height: Float32Array | null;
    };
    private edgeUniforms: EdgeUniforms | null = null;
    private geometry: BufferGeometry | null = null;
    private reflectionControls: ReflectionControls;
    private heightMap: HeightMap | null = null;
    private plateauSites: PlateauSite[] = [];
    private regenerateListeners: Set<() => void> = new Set();
    private buildableCells: BuildableCells | null = null;

    constructor(scene: Scene, gridSystem: GridSystem, camera: PerspectiveCamera, lightingSystem: LightingSystem) {
        this.scene = scene;
        this.gridSystem = gridSystem;
        this.camera = camera;
        this.lightingSystem = lightingSystem;
        // Simon's preferred seed (11 Aug 2026) — this is the exact map the
        // config default above was tuned against. Regenerate (newSeed=true,
        // below) still randomises as normal; only the initial load is pinned.
        this.seed = 470539246;
        this.bufferPool = BufferPool.getInstance();
        this.currentBuffers = { vertex: null, color: null, uv: null, index: null, height: null };

        this.reflectionControls = new ReflectionControls((params) => {
            const shader = (this.material as any)?.customShader;
            if (shader?.uniforms) {
                shader.uniforms.reflectionParams.value.copy(params);
                if (this.material) this.material.needsUpdate = true;
            }
        }, lightingSystem, (reach, width) => {
            const shader = (this.material as any)?.customShader;
            if (shader?.uniforms?.glitterReach) {
                shader.uniforms.glitterReach.value.set(reach, width);
            }
        }, (show) => {
            const shader = (this.material as any)?.customShader;
            if (shader?.uniforms?.debugShowGlitter) {
                shader.uniforms.debugShowGlitter.value = show ? 1 : 0;
            }
        });

        this.initialize();
    }

    // ─── Buffer management ────────────────────────────────────────────────────

    private ensureBufferSize(type: keyof typeof this.currentBuffers, requiredSize: number): void {
        if (this.currentBuffers[type]) {
            this.bufferPool.releaseBuffer(this.currentBuffers[type]!);
            this.currentBuffers[type] = null;
        }
        try {
            const bufferType = type === 'index' ? 'uint32' : 'float32';
            const newBuffer = this.bufferPool.acquireBuffer(requiredSize, bufferType);
            this.currentBuffers[type] = newBuffer as any;
        } catch (error: any) {
            console.error(`Failed to allocate buffer of type ${type} with size ${requiredSize}:`, error);
            throw new Error(`Buffer allocation failed: ${error.message}`);
        }
    }

    private disposeGeometry(): void {
        if (this.geometry) {
            (Object.keys(this.currentBuffers) as Array<keyof typeof this.currentBuffers>).forEach(key => {
                if (this.currentBuffers[key]) {
                    this.bufferPool.releaseBuffer(this.currentBuffers[key]!);
                    this.currentBuffers[key] = null;
                }
            });
            this.geometry.dispose();
            this.geometry = null;
        }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    private async initialize(): Promise<void> {
        try {
            this.terrainMesh = await this.generate();
            this.scene.add(this.terrainMesh);
            if (this.terrainMesh.material instanceof Material) {
                this.material = this.terrainMesh.material;
            }
        } catch (error) {
            console.error('Failed to generate terrain:', error);
        }
    }

    // newSeed=true (Regenerate button): randomises terrain topology
    // newSeed=false (slider change): rebuilds with same topology, new parameters
    public async regenerate(newSeed: boolean = true): Promise<void> {
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            if (this.terrainMesh.material instanceof Material) {
                (this.terrainMesh.material as Material).dispose();
            }
            this.terrainMesh = null;
        }
        if (newSeed) {
            this.seed = newRandomSeed();
        }
        try {
            this.terrainMesh = await this.generate();
            this.scene.add(this.terrainMesh);
            if (this.terrainMesh.material instanceof Material) {
                this.material = this.terrainMesh.material;
            }
        } catch (error) {
            console.error('[TerrainGenerator] generate() threw:', error);
        }
    }

    public dispose(): void {
        this.disposeGeometry();
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            this.terrainMesh = null;
        }
        Object.values(this.currentBuffers).forEach(buffer => {
            if (buffer) this.bufferPool.releaseBuffer(buffer);
        });
        Object.keys(this.currentBuffers).forEach(key => {
            this.currentBuffers[key as keyof typeof this.currentBuffers] = null;
        });
        this.reflectionControls.dispose();
        this.heightMap = null;
        this.buildableCells = null;
        this.regenerateListeners.clear();
    }

    // ─── Terrain generation ───────────────────────────────────────────────────

    public async generate(): Promise<Mesh> {
        this.disposeGeometry();
        this.geometry = new BufferGeometry();
        const totalSize   = this.gridSystem.getTotalSize();
        // Render mesh resolution now matches the logical grid exactly (1 quad
        // = 1 cell). Grid lines need to sit ON real mesh vertices, not
        // approximate a differently-resolved surface — that mismatch was the
        // "gaps"/"doesn't line up" problem. See TerrainGrid.ts.
        const divisions   = this.gridSystem.getCellCount();
        const segmentSize = totalSize / divisions; // === GridParameters.CELL_SIZE, exactly

        const vertexCount = (divisions + 1) * (divisions + 1);
        const indexCount  = divisions * divisions * 6;

        this.ensureBufferSize('vertex', vertexCount * 3);
        this.ensureBufferSize('color',  vertexCount * 3);
        this.ensureBufferSize('uv',     vertexCount * 2);
        this.ensureBufferSize('index',  indexCount);
        this.ensureBufferSize('height', vertexCount);

        const sampler = new NoiseSampler(this.seed, this.config);
        let minHeight =  Infinity;
        let maxHeight = -Infinity;

        // Plateau sites are deterministic given this.seed — same seed always
        // proposes the same build-sites, independent of any live slider change.
        this.plateauSites = this.generatePlateauSites(sampler, totalSize);

        // First pass: generate heights
        for (let z = 0; z <= divisions; z++) {
            for (let x = 0; x <= divisions; x++) {
                const index = x + z * (divisions + 1);
                const xPos  = (x - divisions / 2) * segmentSize;
                const zPos  = (z - divisions / 2) * segmentSize;

                let height = this.sampleBaseHeight(sampler, xPos, zPos);

                if (this.config.valleyEnabled) {
                    const sigma      = this.config.valleyWidth * totalSize * 0.5;
                    const valleyMask = Math.exp(-(xPos * xPos) / (2 * sigma * sigma));
                    height = height * (1.0 - this.config.valleyDepth * valleyMask);
                }

                // Plateau carving runs last so build-sites stay flat regardless
                // of valley carving or any other height modifier above.
                if (this.plateauSites.length > 0) {
                    height = this.applyPlateaus(height, xPos, zPos, this.plateauSites);
                }

                if (this.currentBuffers.height) this.currentBuffers.height[index] = height;
                minHeight = Math.min(minHeight, height);
                maxHeight = Math.max(maxHeight, height);
            }
        }

        // Retain a HeightMap for gameplay queries (not pooled — survives until next regen)
        if (this.currentBuffers.height) {
            this.heightMap = new HeightMap(this.currentBuffers.height, divisions, totalSize);
        }

        // Second pass: vertices, colours, UVs
        let vertexIdx = 0;
        let colorIdx  = 0;
        let uvIdx     = 0;

        for (let z = 0; z <= divisions; z++) {
            for (let x = 0; x <= divisions; x++) {
                const index  = x + z * (divisions + 1);
                const xPos   = (x - divisions / 2) * segmentSize;
                const zPos   = (z - divisions / 2) * segmentSize;
                const height = this.currentBuffers.height ? this.currentBuffers.height[index] : 0;

                const normalizedHeight = Math.pow(Math.max(0, Math.min(1, height / this.config.heightScale)), 1.2);

                if (this.currentBuffers.vertex) {
                    this.currentBuffers.vertex[vertexIdx++] = xPos;
                    this.currentBuffers.vertex[vertexIdx++] = height;
                    this.currentBuffers.vertex[vertexIdx++] = zPos;
                }

                const color = new Color();
                color.copy(TerrainParameters.BASE_COLOR)
                    .multiplyScalar(0.3)
                    .lerp(TerrainParameters.PEAK_COLOR, normalizedHeight);
                if (this.currentBuffers.color) {
                    this.currentBuffers.color[colorIdx++] = color.r;
                    this.currentBuffers.color[colorIdx++] = color.g;
                    this.currentBuffers.color[colorIdx++] = color.b;
                }

                if (this.currentBuffers.uv) {
                    this.currentBuffers.uv[uvIdx++] = x / divisions;
                    this.currentBuffers.uv[uvIdx++] = z / divisions;
                }
            }
        }

        // Indices
        let indexIdx = 0;
        if (this.currentBuffers.index) {
            for (let z = 0; z < divisions; z++) {
                for (let x = 0; x < divisions; x++) {
                    const a = x       + (divisions + 1) * z;
                    const b = x       + (divisions + 1) * (z + 1);
                    const c = (x + 1) + (divisions + 1) * z;
                    const d = (x + 1) + (divisions + 1) * (z + 1);
                    this.currentBuffers.index[indexIdx++] = a;
                    this.currentBuffers.index[indexIdx++] = b;
                    this.currentBuffers.index[indexIdx++] = c;
                    this.currentBuffers.index[indexIdx++] = c;
                    this.currentBuffers.index[indexIdx++] = b;
                    this.currentBuffers.index[indexIdx++] = d;
                }
            }
        }

        if (this.currentBuffers.vertex) this.geometry.setAttribute('position', new Float32BufferAttribute(this.currentBuffers.vertex, 3));
        if (this.currentBuffers.color)  this.geometry.setAttribute('color',    new Float32BufferAttribute(this.currentBuffers.color,  3));
        if (this.currentBuffers.uv)     this.geometry.setAttribute('uv',       new Float32BufferAttribute(this.currentBuffers.uv,     2));
        if (this.currentBuffers.index)  this.geometry.setIndex(new BufferAttribute(this.currentBuffers.index, 1));
        this.geometry.computeVertexNormals();

        const mesh = new Mesh(this.geometry, createTerrainMaterial(totalSize, this.config.heightScale));

        // Terrain grid — colour ramp + pulse handled entirely in EdgeMaterial shader.
        // Geometry comes from TerrainGrid (logical cells), NOT EdgesGeometry — see
        // TerrainGrid.ts for why: this is now the SAME grid used for build placement,
        // not a curvature-triggered wireframe that happened to look grid-like.
        const { material: edgeMaterial, uniforms } = createEdgeMaterial(minHeight, maxHeight);
        this.edgeUniforms = uniforms;

        if (this.heightMap) {
            const gridResult = createTerrainGridMesh(this.gridSystem, this.heightMap);
            gridResult.mesh.material = edgeMaterial;
            this.buildableCells = gridResult.buildable;
            mesh.add(gridResult.mesh);
        }

        // heightMap/plateauSites/seed are all ready at this point — the only
        // things a listener (e.g. a future NavGrid rebuild) would need.
        this.regenerateListeners.forEach(listener => listener());

        return mesh;
    }

    // ─── Per-frame update ─────────────────────────────────────────────────────

    public update(time: number): void {
        const shader = (this.material as any)?.customShader;
        if (shader?.uniforms) {
            // No cameraDirection push needed any more — TerrainMaterial.ts now
            // uses Three's own built-in `cameraPosition` uniform (auto-updated
            // every frame) and computes the view direction per-fragment.
            //
            // sunWorldPosition feeds the sun glitter wedge — see
            // calculateSunGlitter() in TerrainMaterial.ts.
            if (shader.uniforms.sunWorldPosition) {
                shader.uniforms.sunWorldPosition.value.copy(this.lightingSystem.getSunPosition());
            }
            // Glitter width auto-scales with the sun's apparent size (12 Aug
            // 2026, round 17) — see calculateSunGlitter()'s width curve.
            if (shader.uniforms.sunHeightT) {
                shader.uniforms.sunHeightT.value = this.lightingSystem.getSunHeightNormalized();
            }
            // Assign .value, don't replace the uniform object — swapping the
            // object every frame defeats onBeforeCompile's uniform wiring and
            // allocates one throwaway object per frame for no reason.
            if (shader.uniforms.time) {
                shader.uniforms.time.value = time;
            } else {
                shader.uniforms.time = { value: time };
            }
            // Reflection glint tint tracks the ACTUAL current sun colour (was a
            // fixed near-white, disconnected from the sun's own gradient) — so
            // highlights read as catching warm sunset light, not a flat sparkle.
            if (shader.uniforms.sunColor) {
                shader.uniforms.sunColor.value.copy(this.lightingSystem.getSunColor());
            }
        }
        if (this.edgeUniforms) {
            this.edgeUniforms.time.value = time;
        }
    }

    // ─── Public accessors ─────────────────────────────────────────────────────

    /** Edge shader uniforms — mutated directly by EdgeControls for live appearance tuning. */
    public getEdgeUniforms(): EdgeUniforms | null {
        return this.edgeUniforms;
    }

    /** The reflection/sun panel — owned here since it's constructed here (its
     *  onUpdate callback closes over this.material). Exposed for SettingsIO. */
    public getReflectionControls(): ReflectionControls {
        return this.reflectionControls;
    }

    /**
     * HeightMap for the current terrain generation.
     * Available after the first generate() completes; replaced on each regenerate().
     * Use for all gameplay spatial queries: unit placement, slope, orientation, LoS.
     */
    public getHeightMap(): HeightMap | null {
        return this.heightMap;
    }

    /** Flattened build-sites from the current generation (empty if plateauEnabled is false). */
    public getPlateauSites(): readonly PlateauSite[] {
        return this.plateauSites;
    }

    /** Per-cell buildability for the current generation — same grid the visual
     *  terrain lines are drawn from. Use with isFootprintBuildable() from TerrainGrid.ts. */
    public getBuildableCells(): BuildableCells | null {
        return this.buildableCells;
    }

    /** Current terrain seed — same seed + same config always reproduces the same map. */
    public getSeed(): number {
        return this.seed;
    }

    /** Pins the terrain to a specific seed. Takes effect on the next generate()/regenerate(). */
    public setSeed(seed: number): void {
        this.seed = seed | 0;
    }

    /**
     * Notified after every successful generate() (including the very first one
     * and every regenerate() — same-seed slider tweaks too, since the mesh and
     * HeightMap are both replaced wholesale each time).
     * Precedent: GridSystem's addChangeListener, which this mirrors.
     */
    public addRegenerateListener(listener: () => void): void {
        this.regenerateListeners.add(listener);
    }

    public removeRegenerateListener(listener: () => void): void {
        this.regenerateListeners.delete(listener);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private smoothstep(x: number): number {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
    }

    /** Base terrain height (noise + angularize + heightScale) at one world point,
     *  BEFORE valley carving or plateau flattening. Shared by the main generation
     *  loop and plateau site sampling so a plateau sits at its natural elevation.
     *
     *  When regionMaskEnabled, a large-scale flatland/mountain zoning noise
     *  (NoiseSampler.getRegionMask — separate, much lower frequency than the
     *  base/peak layers) scales down both the rolling-hill amplitude and the
     *  angular faceting strength in flatland zones, so those areas read as
     *  genuinely smooth plateaus with minor variation rather than gently
     *  bumpy everywhere. Mountain zones are unaffected (full amplitude).
     *  Disabled, this reproduces the exact prior behaviour (baseAmp/peakAmp/
     *  angularBlendScale all 1.0 are no-ops). */
    private sampleBaseHeight(sampler: NoiseSampler, xPos: number, zPos: number): number {
        const baseN = sampler.getBaseHeight(xPos, zPos);
        const peakN = sampler.getPeakHeight(xPos, zPos);

        let baseAmp = 1.0;
        let peakAmp = 1.0;
        let angularBlendScale = 1.0;

        if (this.config.regionMaskEnabled) {
            const region = sampler.getRegionMask(xPos, zPos); // 0 = flatland, 1 = mountain
            const flatAmp = this.config.regionFlatAmplitude;
            const mountainAmp = this.config.regionMountainAmplitude;
            baseAmp = flatAmp + (mountainAmp - flatAmp) * region;
            peakAmp = region; // peaks fade out smoothly outside mountain zones
            angularBlendScale = baseAmp; // less faceting where flatter — reads as smooth, not just short
        }

        const rawHeight = (baseN * baseAmp) * this.config.basePeakBlend
                        + (peakN * peakAmp) * (1 - this.config.basePeakBlend);
        return this.angularizeHeight(rawHeight, angularBlendScale) * this.config.heightScale;
    }

    /**
     * Picks `plateauCount` flat build-site centres, deterministically from the
     * terrain seed (a dedicated named RNG stream — never shares draws with
     * anything else, so adding randomness elsewhere can't shift these sites).
     * Bounded rejection sampling keeps sites apart; gives up gracefully (fewer
     * sites than requested) rather than looping forever on a crowded config.
     */
    private generatePlateauSites(sampler: NoiseSampler, totalSize: number): PlateauSite[] {
        if (!this.config.plateauEnabled || this.config.plateauCount <= 0) return [];

        const rng = Rng.named(this.seed, 'terrain.plateau');
        const radius  = this.config.plateauRadius;
        const minDist = radius * 2.2; // keep sites from merging into one mega-flat
        const margin  = totalSize * 0.1; // keep sites off the very map edge
        const half    = totalSize / 2 - margin;

        const sites: PlateauSite[] = [];
        const maxAttempts = this.config.plateauCount * 40;
        let attempts = 0;

        while (sites.length < this.config.plateauCount && attempts < maxAttempts) {
            attempts++;
            const x = rng.nextRange(-half, half);
            const z = rng.nextRange(-half, half);
            const farEnough = sites.every(s => {
                const dx = s.x - x, dz = s.z - z;
                return dx * dx + dz * dz >= minDist * minDist;
            });
            if (!farEnough) continue;
            sites.push({ x, z, radius, height: this.sampleBaseHeight(sampler, x, z) });
        }
        return sites;
    }

    /**
     * Blends `height` toward the nearest plateau site's height inside its
     * falloff band. Overlapping sites resolve by strongest influence (max
     * weight) rather than averaging, so two different-elevation plateaus
     * never blur into a slope between them.
     */
    private applyPlateaus(height: number, xPos: number, zPos: number, sites: PlateauSite[]): number {
        const edge = this.config.plateauEdge; // higher = sharper edge — see TerrainControls tooltip
        let bestWeight = 0;
        let bestHeight = height;

        for (const site of sites) {
            const dx = xPos - site.x;
            const dz = zPos - site.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const innerRadius = site.radius * edge;

            let weight: number;
            if (innerRadius === site.radius) {
                weight = dist <= innerRadius ? 1 : 0; // edge=1.0: no transition band
            } else {
                weight = this.smoothstep((dist - site.radius) / (innerRadius - site.radius));
            }

            if (weight > bestWeight) {
                bestWeight = weight;
                bestHeight = site.height;
            }
        }

        return bestWeight > 0 ? height * (1 - bestWeight) + bestHeight * bestWeight : height;
    }

    /** @param blendScale Multiplies the faceting strength — 1.0 (default) reproduces
     *  the original behaviour exactly; lower values keep flatland zones smooth
     *  instead of stair-stepped. See sampleBaseHeight(). */
    private angularizeHeight(height: number, blendScale: number = 1.0): number {
        const steppedHeight = Math.floor(height * TerrainParameters.ANGULAR_STEPS) / TerrainParameters.ANGULAR_STEPS;
        const heightFactor  = Math.pow(this.smoothstep(height), TerrainParameters.ANGULAR_HEIGHT_FACTOR_POWER);
        const blend = (TerrainParameters.MIN_ANGULAR_BLEND
            + Math.pow(heightFactor, TerrainParameters.ANGULAR_BLEND_CURVE)
            * (TerrainParameters.MAX_ANGULAR_BLEND - TerrainParameters.MIN_ANGULAR_BLEND)) * blendScale;
        return height * (1 - blend) + steppedHeight * blend;
    }
}
