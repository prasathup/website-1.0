import { describe, expect, it } from 'vitest';
import {
	centerStageWorldOffsetX,
	SphereSystem,
	type SphereBody
} from '../../src/lib/memories/physics';

const viewport = { width: 1200, height: 800 };

function createBody(partial: Partial<SphereBody> = {}): SphereBody {
	return {
		id: partial.id ?? 0,
		x: partial.x ?? 0,
		y: partial.y ?? 0,
		z: partial.z ?? 0,
		vx: partial.vx ?? 0.5,
		vy: partial.vy ?? 0.2,
		vz: partial.vz ?? 0,
		ax: partial.ax ?? 0,
		ay: partial.ay ?? 0,
		radius: partial.radius ?? 40,
		targetRadius: partial.targetRadius ?? 40,
		originalRadius: partial.originalRadius ?? 40,
		originalX: partial.originalX ?? 0,
		originalY: partial.originalY ?? 0,
		originalZ: partial.originalZ ?? -40,
		isCentered: partial.isCentered ?? false,
		targetZ: partial.targetZ ?? partial.z ?? 0,
		depthBand: partial.depthBand ?? 'near',
		driftAngle: partial.driftAngle ?? 0,
		driftSpeed: partial.driftSpeed ?? 0.5
	};
}

describe('SphereSystem (world space)', () => {
	it('keeps centered bodies frozen in velocity while easing toward origin', () => {
		const system = new SphereSystem(() => ({
			friction: 0.96,
			brownianStrength: 0.05,
			boundaryStiffness: 0,
			separationForce: 0,
			separationDistance: 0
		}), () => 0.5);
		const centered = createBody({ id: 0, isCentered: true, x: 200, y: 100, z: -80, vx: 5, vy: 5 });
		const mover = createBody({ id: 1, x: 50, y: 50 });
		system.setBodies([centered, mover], viewport);
		system.centerBody(0);
		system.step();

		const bodies = system.getBodies();
		expect(bodies[0]?.vx).toBe(0);
		expect(bodies[0]?.vy).toBe(0);
		expect(bodies[1]?.x).not.toBe(50);
	});

	it('eases centered body toward camera look-at stage, not world origin', () => {
		const system = new SphereSystem(undefined, () => 0.5);
		const body = createBody({ id: 0, x: 400, y: -200, z: -100 });
		system.setBodies([body], viewport);
		system.centerBody(0, 900, 120, -40);
		for (let i = 0; i < 200; i++) system.step();
		const settled = system.getBodies()[0]!;
		// Optical nudge (main width/2+20 lineage; tuned to 14px).
		const nudge = centerStageWorldOffsetX(900, 52, viewport);
		expect(settled.x).toBeCloseTo(120 + nudge, 0);
		expect(settled.y).toBeCloseTo(-40, 0);
		expect(settled.z).toBeCloseTo(0, 0);
	});

	it('center ease wall-clock matches at 60Hz vs 120Hz step sizes', () => {
		const make = () => {
			const system = new SphereSystem(undefined, () => 0.5);
			const body = createBody({ id: 0, x: 400, y: -200, z: -100 });
			system.setBodies([body], viewport);
			system.centerBody(0, 900, 0, 0);
			return system;
		};
		const at60 = make();
		const at120 = make();
		// ~0.5s wall clock
		for (let i = 0; i < 30; i++) at60.step(1 / 60);
		for (let i = 0; i < 60; i++) at120.step(1 / 120);
		expect(at120.getBodies()[0]!.x).toBeCloseTo(at60.getBodies()[0]!.x, 1);
		expect(at120.getBodies()[0]!.centerProgress).toBeCloseTo(at60.getBodies()[0]!.centerProgress!, 5);
	});

	it('soft-bounds bodies inside world volume', () => {
		const system = new SphereSystem(undefined, () => 0.5);
		const body = createBody({
			id: 0,
			x: -5000,
			y: 0,
			vx: -2,
			driftAngle: Math.PI
		});
		system.setBodies([body], viewport, {
			minX: -900,
			maxX: 900,
			minY: -560,
			maxY: 560,
			minZ: -1400,
			maxZ: 80
		});
		system.step();
		expect(system.getBodies()[0]?.x).toBeGreaterThan(-950);
	});
});
