declare module 'simplex-noise-esm' {
    export class SimplexNoise {
        constructor(randomFn?: () => number);
        noise2D(x: number, y: number): number;
        noise3D(x: number, y: number, z: number): number;
        noise4D(x: number, y: number, z: number, w: number): number;
    }
} 