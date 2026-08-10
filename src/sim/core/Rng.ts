/**
 * Deterministic PRNG for the simulation layer.
 *
 * sfc32 (Chris Doty-Humphrey's "Small Fast Counter" RNG): 128-bit state,
 * period > 2^128, passes PractRand. Built entirely from `+ - *` (via
 * `Math.imul`), bitwise ops and `>>>` — all exactly specified by ECMA-262,
 * so two JS engines given the same seed produce bit-identical sequences
 * forever. That bit-for-bit guarantee is what lockstep determinism depends on.
 *
 * RULE: sim code may use ONLY this RNG for randomness. `Math.random()` is
 * banned anywhere under src/sim/ — see the project's sim Architecture Rules
 * (CLAUDE.md / the game-sim master plan).
 */

export interface RngState {
    a: number;
    b: number;
    c: number;
    d: number;
}

/** Derives 4 well-mixed 32-bit words from a single numeric seed (xmur3-style avalanche). */
function seedWords(seed: number): RngState {
    let h = (1779033703 ^ seed) >>> 0;
    const next = (): number => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h = h ^ (h >>> 16);
        return h >>> 0;
    };
    return { a: next(), b: next(), c: next(), d: next() };
}

export class Rng {
    private a: number;
    private b: number;
    private c: number;
    private d: number;

    constructor(seed: number) {
        const s = seedWords(seed >>> 0);
        this.a = s.a; this.b = s.b; this.c = s.c; this.d = s.d;
    }

    /**
     * Named sub-stream — deterministic given (seed, name), so independent
     * systems (terrain, spawns, combat) drawing from the same match seed
     * never perturb each other's sequences by drawing in a different order
     * or a different number of times.
     */
    static named(seed: number, name: string): Rng {
        let h = (seed ^ 0x9e3779b9) >>> 0;
        for (let i = 0; i < name.length; i++) {
            h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0; // FNV-1a-style fold
        }
        return new Rng(h);
    }

    /** Raw 32-bit output, [0, 2^32). */
    nextU32(): number {
        let { a, b, c, d } = this;
        let t = (a + b) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        d = (d + 1) | 0;
        t = (t + d) | 0;
        c = (c + t) | 0;
        this.a = a; this.b = b; this.c = c; this.d = d;
        return t >>> 0;
    }

    /** Float in [0, 1). */
    nextFloat(): number {
        return this.nextU32() / 4294967296;
    }

    /** Float in [min, max). */
    nextRange(min: number, max: number): number {
        return min + this.nextFloat() * (max - min);
    }

    /** Integer in [0, n). Not cryptographically unbiased — fine for gameplay use. */
    nextIntBelow(n: number): number {
        return Math.floor(this.nextFloat() * n);
    }

    getState(): RngState {
        return { a: this.a, b: this.b, c: this.c, d: this.d };
    }

    static fromState(state: RngState): Rng {
        const rng = Object.create(Rng.prototype) as Rng;
        rng.a = state.a; rng.b = state.b; rng.c = state.c; rng.d = state.d;
        return rng;
    }
}
