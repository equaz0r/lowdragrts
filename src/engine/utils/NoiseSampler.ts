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
}
