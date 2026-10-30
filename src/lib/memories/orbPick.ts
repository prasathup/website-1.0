import type { Intersection, Object3D } from 'three';

/** Inscribed-circle fraction of the unit plane (0.5 = full disc). Slightly under to match glass rim. */
export const ORB_PICK_RADIUS = 0.48;

/**
 * Overlay pick meshes are square planes; glass art is circular.
 * Keep the closest hit whose UV lies inside the disc so transparent corners
 * do not steal clicks from a neighboring orb.
 */
export function firstCircularOrbHit(
	intersects: ReadonlyArray<Intersection<Object3D>>,
	radius = ORB_PICK_RADIUS
): Intersection<Object3D> | undefined {
	const r2 = radius * radius;
	for (const hit of intersects) {
		const uv = hit.uv;
		if (!uv) return hit;
		const dx = uv.x - 0.5;
		const dy = uv.y - 0.5;
		if (dx * dx + dy * dy <= r2) return hit;
	}
	return undefined;
}
