import { describe, expect, it } from 'vitest';
import {
	centerStageWorldOffsetX,
	SphereSystem,
	type SphereBody
} from '../../src/lib/memories/physics';

const viewport = { width: 390, height: 844 };

describe('centerStageWorldOffsetX', () => {
	it('applies a 14px optical nudge in world units', () => {
		const dolly = 900;
		const worldH = 2 * dolly * Math.tan((50 * Math.PI) / 360);
		const expected = 14 * (worldH / viewport.height);
		expect(centerStageWorldOffsetX(dolly, 50, viewport)).toBeCloseTo(expected, 5);
	});
});

describe('SphereSystem center optical nudge', () => {
	function createBody(partial: Partial<SphereBody> = {}): SphereBody {
		return {
			id: partial.id ?? 0,
			x: partial.x ?? 0,
			y: partial.y ?? 0,
			z: partial.z ?? 0,
			vx: 0,
			vy: 0,
			vz: 0,
			ax: 0,
			ay: 0,
			radius: 40,
			targetRadius: 40,
			originalRadius: 40,
			originalX: 0,
			originalY: 0,
			originalZ: -40,
			isCentered: false,
			targetZ: 0,
			depthBand: 'near',
			driftAngle: 0,
			driftSpeed: 0.5
		};
	}

	it('stages right of look-at by the optical nudge', () => {
		const system = new SphereSystem(undefined, () => 0.5);
		const body = createBody({ id: 0, x: -100, y: 50, z: -80 });
		system.setBodies([body], viewport);
		system.centerBody(0, 900, 10, -20);
		const nudge = centerStageWorldOffsetX(900, 52, viewport);
		expect(system.getBodies()[0]!.centerTargetX).toBeCloseTo(10 + nudge, 5);
		expect(system.getBodies()[0]!.centerTargetY).toBe(-20);
		for (let i = 0; i < 200; i++) system.step();
		const settled = system.getBodies()[0]!;
		expect(settled.x).toBeCloseTo(10 + nudge, 0);
		expect(settled.y).toBeCloseTo(-20, 0);
	});
});
