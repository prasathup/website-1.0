import { describe, expect, it } from 'vitest';
import type { Intersection, Object3D, Vector2 } from 'three';
import { firstCircularOrbHit, ORB_PICK_RADIUS } from '../../src/lib/memories/orbPick';

function hit(uv: { x: number; y: number } | undefined, name: string): Intersection<Object3D> {
	return {
		distance: 1,
		point: {} as Intersection['point'],
		object: { name } as Object3D,
		uv: uv as Vector2 | undefined
	} as Intersection<Object3D>;
}

describe('firstCircularOrbHit', () => {
	it('skips square-corner hits and takes the first UV inside the disc', () => {
		const corner = hit({ x: 0.05, y: 0.05 }, 'side-plane-corner');
		const center = hit({ x: 0.5, y: 0.5 }, 'front-orb');
		const picked = firstCircularOrbHit([corner, center]);
		expect(picked?.object.name).toBe('front-orb');
	});

	it('accepts the rim just inside ORB_PICK_RADIUS', () => {
		const rim = hit({ x: 0.5 + ORB_PICK_RADIUS * 0.9, y: 0.5 }, 'rim');
		expect(firstCircularOrbHit([rim])?.object.name).toBe('rim');
	});

	it('rejects outside the disc and returns undefined when nothing qualifies', () => {
		const outside = hit({ x: 0.99, y: 0.99 }, 'outside');
		expect(firstCircularOrbHit([outside])).toBeUndefined();
	});
});
