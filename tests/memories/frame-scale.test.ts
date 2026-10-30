import { describe, expect, it } from 'vitest';
import { frameScale, lerpFactor, REF_DT_SEC } from '../../src/lib/memories/frameScale';

describe('frameScale', () => {
	it('is 1 at 60fps and ~0.5 at 120Hz', () => {
		expect(frameScale(REF_DT_SEC)).toBeCloseTo(1, 5);
		expect(frameScale(1 / 120)).toBeCloseTo(0.5, 5);
	});

	it('caps hitch spikes', () => {
		expect(frameScale(1)).toBe(2.5);
	});
});

describe('lerpFactor', () => {
	it('matches one 60fps step when frames=1', () => {
		expect(lerpFactor(0.12, 1)).toBeCloseTo(0.12, 5);
	});

	it('two half-frames ≈ one full frame (Chrome 120Hz vs Safari 60Hz)', () => {
		const k = 0.12;
		let x = 0;
		const target = 1;
		x += (target - x) * lerpFactor(k, 0.5);
		x += (target - x) * lerpFactor(k, 0.5);
		const oneStep = lerpFactor(k, 1);
		expect(x).toBeCloseTo(oneStep, 5);
	});
});
