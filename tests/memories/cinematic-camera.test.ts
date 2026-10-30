import { describe, expect, it } from 'vitest';
import {
	CINEMATIC_DEFAULT_DOLLY,
	CINEMATIC_LOOK_AHEAD,
	CINEMATIC_MAX_DOLLY,
	CINEMATIC_MIN_DOLLY,
	dollyFromPinch,
	FOV_AT_DEFAULT_DOLLY,
	FOV_AT_MAX_DOLLY,
	FOV_AT_MIN_DOLLY,
	fovForDolly,
	lookAtZForDolly
} from '../../src/lib/memories/cinematicCamera';

describe('lookAtZForDolly', () => {
	it('keeps default framing on the z=0 plane', () => {
		expect(lookAtZForDolly(CINEMATIC_DEFAULT_DOLLY)).toBe(0);
	});

	it('carries look-at into the deep field as the camera dives past 0', () => {
		expect(lookAtZForDolly(0)).toBe(-CINEMATIC_LOOK_AHEAD);
		expect(lookAtZForDolly(CINEMATIC_MIN_DOLLY)).toBe(
			CINEMATIC_MIN_DOLLY - CINEMATIC_LOOK_AHEAD
		);
	});
});

describe('dollyFromPinch', () => {
	it('dives in when fingers spread (works with negative dolly)', () => {
		expect(dollyFromPinch(900, 100, 150)).toBeLessThan(900);
		expect(dollyFromPinch(-400, 100, 150)).toBeLessThan(-400);
	});
});

describe('fovForDolly', () => {
	it('anchors default / min / max dolly to the cinematic FOV curve', () => {
		expect(fovForDolly(CINEMATIC_DEFAULT_DOLLY)).toBeCloseTo(FOV_AT_DEFAULT_DOLLY, 5);
		expect(fovForDolly(CINEMATIC_MIN_DOLLY)).toBeCloseTo(FOV_AT_MIN_DOLLY, 5);
		expect(fovForDolly(CINEMATIC_MAX_DOLLY)).toBeCloseTo(FOV_AT_MAX_DOLLY, 5);
	});

	it('widens FOV as dolly decreases (dive in)', () => {
		const far = fovForDolly(1400);
		const mid = fovForDolly(900);
		const near = fovForDolly(0);
		expect(near).toBeGreaterThan(mid);
		expect(mid).toBeGreaterThan(far);
	});

	it('clamps outside the dolly range', () => {
		expect(fovForDolly(CINEMATIC_MIN_DOLLY - 500)).toBeCloseTo(FOV_AT_MIN_DOLLY, 5);
		expect(fovForDolly(5000)).toBeCloseTo(FOV_AT_MAX_DOLLY, 5);
	});
});
