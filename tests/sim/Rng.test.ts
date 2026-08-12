import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/sim/core/Rng';

describe('Rng determinism', () => {
    it('matches the checked-in golden sequence', () => {
        const rng = new Rng(123456789);
        expect(Array.from({ length: 10 }, () => rng.nextU32())).toEqual([
            402386677, 4140371975, 989147372, 4185758427, 2513711265,
            2429347099, 3713701636, 216279029, 1919464271, 1292155375,
        ]);
    });

    it('resumes exactly from serialized state', () => {
        const first = Rng.named(42, 'combat.damage');
        Array.from({ length: 25 }, () => first.nextU32());
        const resumed = Rng.fromState(first.getState());
        expect(Array.from({ length: 1000 }, () => resumed.nextU32())).toEqual(
            Array.from({ length: 1000 }, () => first.nextU32()),
        );
    });

    it('keeps generated values inside their documented boundaries', () => {
        const rng = new Rng(7);
        for (let i = 0; i < 10_000; i++) {
            const float = rng.nextFloat();
            expect(float).toBeGreaterThanOrEqual(0);
            expect(float).toBeLessThan(1);
            const integer = rng.nextIntBelow(17);
            expect(integer).toBeGreaterThanOrEqual(0);
            expect(integer).toBeLessThan(17);
        }
    });
});
