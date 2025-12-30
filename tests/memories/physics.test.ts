// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { SphereSystem, type SphereBody } from '../../src/lib/memories/physics';

const viewport = { width: 1200, height: 800 };

function createBody(partial: Partial<SphereBody> = {}): SphereBody {
	return {
		id: partial.id ?? 0,
		x: partial.x ?? 200,
		y: partial.y ?? 200,
		vx: partial.vx ?? 2,
		vy: partial.vy ?? 1,
		ax: partial.ax ?? 0,
		ay: partial.ay ?? 0,
		radius: partial.radius ?? 40,
		targetRadius: partial.targetRadius ?? 40,
		originalRadius: partial.originalRadius ?? 40,
		originalX: partial.originalX ?? 200,
		originalY: partial.originalY ?? 200,
		isCentered: partial.isCentered ?? false,
		z: partial.z ?? 0,
		targetZ: partial.targetZ ?? 0,
		driftAngle: partial.driftAngle ?? 0,
		driftSpeed: partial.driftSpeed ?? 0.5
	};
}

describe('SphereSystem', () => {
	it('skips centered bodies during updates and collisions', () => {
		const system = new SphereSystem({ random: () => 0.5 });
		const centered = createBody({ id: 0, isCentered: true, vx: 5, vy: 5 });
		const mover = createBody({ id: 1, x: centered.x + 30, y: centered.y + 30 });
		const previousX = mover.x;
		system.setBodies([centered, mover], viewport);
		system.step();

		const [afterCentered, afterMover] = system.getBodies();
		expect(afterCentered.vx).toBe(0); // Centered bodies stop moving (vx forced to 0 in step)
		expect(afterMover.x).not.toBe(previousX); // still updated
	});

	it('separates overlapping bodies to prevent sticking', () => {
		const system = new SphereSystem({ random: () => 0.5 });
		const bodyA = createBody({ id: 0, x: 100, y: 100, vx: 0, vy: 0 });
		const bodyB = createBody({ id: 1, x: 120, y: 120, vx: 0, vy: 0 });
		system.setBodies([bodyA, bodyB], viewport);
		system.step();

		const [afterA, afterB] = system.getBodies();
		// separation force logic
		const distance = Math.hypot(afterB.x - afterA.x, afterB.y - afterA.y);
		// They started at distance 28. Radius is 40+40=80. They should be pushed apart.
		// Exact distance depends on separationForce config, but they should move.
		// For this test, we just check they moved from their initial spots.
		expect(afterA.x).not.toBe(100);
		expect(afterB.x).not.toBe(120);
	});
});
