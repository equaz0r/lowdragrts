declare module 'fastnoise-lite' {
    export default class FastNoiseLite {
        constructor(seed?: number);

        SetSeed(seed: number): void;
        SetFrequency(frequency: number): void;
        SetNoiseType(noiseType: string): void;
        SetFractalType(fractalType: string): void;
        SetFractalOctaves(octaves: number): void;
        SetFractalLacunarity(lacunarity: number): void;
        SetFractalGain(gain: number): void;
        SetFractalWeightedStrength(weightedStrength: number): void;
        SetFractalPingPongStrength(pingPongStrength: number): void;
        SetCellularDistanceFunction(fn: string): void;
        SetCellularReturnType(returnType: string): void;
        SetCellularJitter(jitter: number): void;
        SetDomainWarpType(type: string): void;
        SetDomainWarpAmp(amp: number): void;

        GetNoise(x: number, y: number): number;

        static NoiseType: Readonly<{
            OpenSimplex2: string;
            OpenSimplex2S: string;
            Cellular: string;
            Perlin: string;
            ValueCubic: string;
            Value: string;
        }>;

        static FractalType: Readonly<{
            None: string;
            FBm: string;
            Ridged: string;
            PingPong: string;
            DomainWarpProgressive: string;
            DomainWarpIndependent: string;
        }>;

        static CellularDistanceFunction: Readonly<{
            Euclidean: string;
            EuclideanSq: string;
            Manhattan: string;
            Hybrid: string;
        }>;

        static CellularReturnType: Readonly<{
            CellValue: string;
            Distance: string;
            Distance2: string;
            Distance2Add: string;
            Distance2Sub: string;
            Distance2Mul: string;
            Distance2Div: string;
        }>;

        static DomainWarpType: Readonly<{
            OpenSimplex2: string;
            OpenSimplex2Reduced: string;
            BasicGrid: string;
        }>;
    }
}
