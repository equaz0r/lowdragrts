import {
    BufferGeometry,
    Float32BufferAttribute,
    Mesh,
    Color,
    LineSegments,
    EdgesGeometry,
    PerspectiveCamera,
    Material,
    Scene,
    BufferAttribute,
} from 'three';
import { GridSystem } from './GridSystem';
import { HeightMap } from './HeightMap';
import { createTerrainMaterial } from './TerrainMaterial';
import { createEdgeMaterial, EdgeUniforms } from './EdgeMaterial';
import { NoiseSampler } from '../utils/NoiseSampler';
import { TerrainParameters } from '../config/TerrainConfig';
import { ReflectionControls } from '../ui/ReflectionControls';
import { LightingSystem } from './LightingSystem';
import { BufferPool } from '../utils/BufferPool';

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
}

export class TerrainGenerator {
    public config: TerrainConfig = {
        heightScale:   TerrainParameters.HEIGHT_SCALE,
        persistence:   TerrainParameters.PERSISTENCE,
        basePeakBlend: 0.6,
        baseFrequency: 0.0004,
        peakFrequency: 0.0008,
        warpAmplitude: 350,
        warpFrequency: 0.0002,
        peakThreshold: 0.40,
        baseOctaves:   5,
        peakOctaves:   6,
        valleyEnabled: true,
        valleyWidth:   0.18,
        valleyDepth:   0.72,
    };

    private readonly gridSystem: GridSystem;
    private readonly camera: PerspectiveCamera;
    private readonly scene: Scene;
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

    constructor(scene: Scene, gridSystem: GridSystem, camera: PerspectiveCamera, lightingSystem: LightingSystem) {
        this.scene = scene;
        this.gridSystem = gridSystem;
        this.camera = camera;
        this.seed = Math.random() * 2147483647 | 0;
        this.bufferPool = BufferPool.getInstance();
        this.currentBuffers = { vertex: null, color: null, uv: null, index: null, height: null };

        this.reflectionControls = new ReflectionControls((params) => {
            const shader = (this.material as any)?.customShader;
            if (shader?.uniforms) {
                shader.uniforms.reflectionParams.value.copy(params);
                if (this.material) this.material.needsUpdate = true;
            }
        }, lightingSystem);

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
            this.seed = Math.random() * 2147483647 | 0;
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
    }

    // ─── Terrain generation ───────────────────────────────────────────────────

    public async generate(): Promise<Mesh> {
        this.disposeGeometry();
        this.geometry = new BufferGeometry();
        const totalSize   = this.gridSystem.getTotalSize();
        const divisions   = this.gridSystem.getGridDivisions() * 2;
        const segmentSize = totalSize / divisions;

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

        // First pass: generate heights
        for (let z = 0; z <= divisions; z++) {
            for (let x = 0; x <= divisions; x++) {
                const index = x + z * (divisions + 1);
                const xPos  = (x - divisions / 2) * segmentSize;
                const zPos  = (z - divisions / 2) * segmentSize;

                const rawHeight = sampler.getBaseHeight(xPos, zPos) * this.config.basePeakBlend
                                + sampler.getPeakHeight(xPos, zPos) * (1 - this.config.basePeakBlend);
                let height = this.angularizeHeight(rawHeight) * this.config.heightScale;

                if (this.config.valleyEnabled) {
                    const sigma      = this.config.valleyWidth * totalSize * 0.5;
                    const valleyMask = Math.exp(-(xPos * xPos) / (2 * sigma * sigma));
                    height = height * (1.0 - this.config.valleyDepth * valleyMask);
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

        const mesh = new Mesh(this.geometry, createTerrainMaterial(totalSize));

        // Edge wireframe — colour and animation handled entirely in EdgeMaterial shader
        const { material: edgeMaterial, uniforms } = createEdgeMaterial(minHeight, maxHeight);
        this.edgeUniforms = uniforms;
        mesh.add(new LineSegments(new EdgesGeometry(this.geometry, 0.1), edgeMaterial));

        return mesh;
    }

    // ─── Per-frame update ─────────────────────────────────────────────────────

    public update(time: number): void {
        const shader = (this.material as any)?.customShader;
        if (shader?.uniforms) {
            shader.uniforms.cameraDirection.value.copy(this.camera.position).normalize();
            shader.uniforms.time = { value: time };
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

    /**
     * HeightMap for the current terrain generation.
     * Available after the first generate() completes; replaced on each regenerate().
     * Use for all gameplay spatial queries: unit placement, slope, orientation, LoS.
     */
    public getHeightMap(): HeightMap | null {
        return this.heightMap;
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private smoothstep(x: number): number {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
    }

    private angularizeHeight(height: number): number {
        const steppedHeight = Math.floor(height * TerrainParameters.ANGULAR_STEPS) / TerrainParameters.ANGULAR_STEPS;
        const heightFactor  = Math.pow(this.smoothstep(height), TerrainParameters.ANGULAR_HEIGHT_FACTOR_POWER);
        const blend = TerrainParameters.MIN_ANGULAR_BLEND
            + Math.pow(heightFactor, TerrainParameters.ANGULAR_BLEND_CURVE)
            * (TerrainParameters.MAX_ANGULAR_BLEND - TerrainParameters.MIN_ANGULAR_BLEND);
        return height * (1 - blend) + steppedHeight * blend;
    }
}
