import { describe, expect, it } from 'vitest';
import { GLASS_FRAME_MS_24, normalizeGlassFrameDurationMs } from '../../src/lib/memories/glassTiming';
import { worldRadiusForCenterStage, worldRadiusForScreenFill } from '../../src/lib/memories/physics';

describe('normalizeGlassFrameDurationMs', () => {
	it('treats WebCodecs microsecond durations as ms via /1000', () => {
		expect(normalizeGlassFrameDurationMs(41667)).toBeCloseTo(41.667, 1);
	});

	it('keeps small millisecond values without dividing again', () => {
		expect(normalizeGlassFrameDurationMs(42)).toBe(42);
	});

	it('falls back to 24fps when missing or invalid', () => {
		expect(normalizeGlassFrameDurationMs(null)).toBeCloseTo(GLASS_FRAME_MS_24, 3);
		expect(normalizeGlassFrameDurationMs(0)).toBeCloseTo(GLASS_FRAME_MS_24, 3);
		expect(normalizeGlassFrameDurationMs(-1)).toBeCloseTo(GLASS_FRAME_MS_24, 3);
	});
});

describe('worldRadiusForScreenFill', () => {
	it('targets requested viewport height fraction at default dolly/FOV', () => {
		const dolly = 900;
		const fovDeg = 50;
		const fill = 0.88;
		const radius = worldRadiusForScreenFill(dolly, fovDeg, fill);
		const worldH = 2 * dolly * Math.tan((fovDeg * Math.PI) / 360);
		expect((radius * 2) / worldH).toBeCloseTo(fill, 5);
	});
});

describe('worldRadiusForCenterStage', () => {
	it('uses legacy oversized diameter on desktop (~1.9× viewport height)', () => {
		const viewport = { width: 1440, height: 900 };
		const dolly = 900;
		const fovDeg = 50;
		const radius = worldRadiusForCenterStage(dolly, fovDeg, viewport);
		const worldH = 2 * dolly * Math.tan((fovDeg * Math.PI) / 360);
		const screenFill = (radius * 2) / worldH;
		expect(screenFill).toBeGreaterThan(1.5);
		expect(screenFill).toBeLessThan(2.1);
	});

	it('matches main mobile fill (~1.1× viewport height, not width-capped)', () => {
		const viewport = { width: 390, height: 844 };
		const dolly = 900;
		const fovDeg = 50;
		const radius = worldRadiusForCenterStage(dolly, fovDeg, viewport);
		const worldH = 2 * dolly * Math.tan((fovDeg * Math.PI) / 360);
		const screenFillH = (radius * 2) / worldH;
		// Main: min(height*1.1, width*2.5)/height ≈ 1.1
		expect(screenFillH).toBeCloseTo(1.1, 2);
		expect(radius * 2).toBeGreaterThan(viewport.width);
	});
});
