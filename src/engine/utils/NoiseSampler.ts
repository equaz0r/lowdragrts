import FastNoiseLite from 'fastnoise-lite';

export interface NoiseSamplerConfig {
    persistence:   number;   // fractal gain (0.3–0.8)
    baseFrequency: number;   // e.g. 0.0004
    peakFrequency: number;   // e.g. 0.0008
    warpAmplitude: number;   // world-unit displacement (0 = off)
    warpFrequency: number;   // e.g. 0.0002
    peakThreshold: number;   // [0,1] — values below are zeroed
    baseOctaves:   number;
    peakOctaves:   number;
    regionMaskFrequency: number; // e.g. 0.00004 — big, coherent flatland/mountain zones
}

/**
 * NoiseSampler wraps FastNoiseLite to provide terrain height sampling.
 *
 *  baseFbm    — OpenSimplex2S + FBm  → broad rolling hills, returns [-1, 1]
 *  peakRidged — OpenSimplex2S + Ridged → sharp mountain ridges, returns [0, 1]
 *  warpX/Z    — low-freq FBm that displaces XZ before sampling above,
 *               breaking the simplex lattice star pattern
 */
export class NoiseSampler {
    private readonly baseFbm:    FastNoiseLite;
    private readonly peakRidged: FastNoiseLite;
    private readonly warpX:      FastNoiseLite;
    private readonly warpZ:      FastNoiseLite;
    private readonly regionMask: FastNoiseLite;
    private readonly warpAmp:    number;
    private readonly peakWarpAmp: number;
    private readonly threshold:  number;

    constructor(seed: number, cfg: NoiseSamplerConfig) {
        this.warpAmp     = cfg.warpAmplitude;
        this.peakWarpAmp = cfg.warpAmplitude * 0.5; // lighter warp keeps ridges crisp
        this.threshold   = cfg.peakThreshold;

        // Base terrain — smooth rolling hills
        this.baseFbm = new FastNoiseLite(seed);
        this.baseFbm.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S);
        this.baseFbm.SetFractalType(FastNoiseLite.FractalType.FBm);
        this.baseFbm.SetFractalOctaves(cfg.baseOctaves);
        this.baseFbm.SetFractalLacunarity(2.0);
        this.baseFbm.SetFractalGain(cfg.persistence);
        this.baseFbm.SetFrequency(cfg.baseFrequency);

        // Mountain peaks — ridged multifractal
        this.peakRidged = new FastNoiseLite(seed + 31337);
        this.peakRidged.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S);
        this.peakRidged.SetFractalType(FastNoiseLite.FractalType.Ridged);
        this.peakRidged.SetFractalOctaves(cfg.peakOctaves);
        this.peakRidged.SetFractalLacunarity(2.0);
        this.peakRidged.SetFractalGain(cfg.persistence);
        this.peakRidged.SetFrequency(cfg.peakFrequency);

        // Domain warp — two independent low-freq samplers
        this.warpX = new FastNoiseLite(seed + 7919);
        this.warpX.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.warpX.SetFractalType(FastNoiseLite.FractalType.FBm);
        this.warpX.SetFractalOctaves(3);
        this.warpX.SetFractalGain(0.5);
        this.warpX.SetFrequency(cfg.warpFrequency);

        this.warpZ = new FastNoiseLite(seed + 104723);
        this.warpZ.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.warpZ.SetFractalType(FastNoiseLite.FractalType.FBm);
        this.warpZ.SetFractalOctaves(3);
        this.warpZ.SetFractalGain(0.5);
        this.warpZ.SetFrequency(cfg.warpFrequency);

        // Region mask — large-scale flatland vs mountain-range zoning. Low
        // frequency + few octaves on purpose: this should produce big, coherent
        // blobs (thousands of world units across), not detail. No domain warp
        // applied — at this scale lattice artifacts aren't visually relevant,
        // and warping would just blur the zone boundaries we want to keep clear.
        this.regionMask = new FastNoiseLite(seed + 271828);
        this.regionMask.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S);
        this.regionMask.SetFractalType(FastNoiseLite.FractalType.FBm);
        this.regionMask.SetFractalOctaves(3);
        this.regionMask.SetFractalLacunarity(2.0);
        this.regionMask.SetFractalGain(0.5);
        this.regionMask.SetFrequency(cfg.regionMaskFrequency);
    }

    private warpCoords(x: number, z: number, amplitude: number): [number, number] {
        return [
            x + this.warpX.GetNoise(x, z)           * amplitude,
            z + this.warpZ.GetNoise(x + 3.7, z + 8.3) * amplitude,
        ];
    }

    /** Broad rolling base terrain. Returns [-1, 1]. */
    getBaseHeight(x: number, z: number): number {
        const [wx, wz] = this.warpCoords(x, z, this.warpAmp);
        return this.baseFbm.GetNoise(wx, wz);
    }

    /** Mountain ridges, zero in flatlands. Returns [0, 1]. */
    getPeakHeight(x: number, z: number): number {
        const [wx, wz] = this.warpCoords(x, z, this.peakWarpAmp);
        const raw        = this.peakRidged.GetNoise(wx, wz); // [-1, 1]
        const normalized = (raw + 1) * 0.5;                  // [0, 1]
        if (normalized < this.threshold) return 0;
        return (normalized - this.threshold) / (1 - this.threshold);
    }

    /**
     * Large-scale flatland-vs-mountain zoning. 0 = flatland, 1 = mountain
     * range, with a smooth transition band between — shaped with a contrast
     * curve (smoothstep over a narrowed input range) so most of the map reads
     * as clearly one or the other, not a uniform gradient everywhere.
     */
    getRegionMask(x: number, z: number): number {
        const raw01 = (this.regionMask.GetNoise(x, z) + 1) * 0.5; // [0, 1]
        const t = Math.max(0, Math.min(1, (raw01 - 0.35) / (0.65 - 0.35)));
        return t * t * (3 - 2 * t); // smoothstep
    }
}
