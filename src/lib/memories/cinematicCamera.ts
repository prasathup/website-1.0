/**
 * Dolly-linked vertical FOV + travel range for the cinematic memory-cloud dive.
 *
 * Camera sits at `dolly` on Z and looks at `dolly - LOOK_AHEAD`, so default
 * framing (900 → look-at 0) matches the original cloud. Zooming in past 0
 * carries the camera into the deep field so far orbs become approachable.
 */
export const CINEMATIC_LOOK_AHEAD = 900;
/** Deepest camera Z — among / past the deep band so tiny orbs can be reached. */
export const CINEMATIC_MIN_DOLLY = -1000;
export const CINEMATIC_MAX_DOLLY = 2400;
export const CINEMATIC_DEFAULT_DOLLY = 900;
export const FOV_AT_MIN_DOLLY = 62;
export const FOV_AT_DEFAULT_DOLLY = 52;
export const FOV_AT_MAX_DOLLY = 50;

function clamp01(t: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	return t;
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** World Z the camera looks at for a given dolly (always LOOK_AHEAD ahead). */
export function lookAtZForDolly(
	dolly: number,
	lookAhead: number = CINEMATIC_LOOK_AHEAD
): number {
	return dolly - lookAhead;
}

/** Pinch pixels → dolly delta. Spread fingers (dist↑) → dolly↓ (dive in). */
export const PINCH_DOLLY_SENSITIVITY = 4.5;

export function dollyFromPinch(
	startDolly: number,
	startDist: number,
	dist: number,
	sensitivity: number = PINCH_DOLLY_SENSITIVITY
): number {
	return startDolly + (startDist - dist) * sensitivity;
}

/**
 * Map dolly → FOV (degrees). Deeper dive → wider FOV.
 * Piecewise so default dolly lands exactly on FOV_AT_DEFAULT_DOLLY.
 */
export function fovForDolly(
	dolly: number,
	opts: {
		minDolly?: number;
		maxDolly?: number;
		defaultDolly?: number;
		fovMin?: number;
		fovDefault?: number;
		fovMax?: number;
	} = {}
): number {
	const minD = opts.minDolly ?? CINEMATIC_MIN_DOLLY;
	const maxD = opts.maxDolly ?? CINEMATIC_MAX_DOLLY;
	const defD = opts.defaultDolly ?? CINEMATIC_DEFAULT_DOLLY;
	const fovNear = opts.fovMin ?? FOV_AT_MIN_DOLLY;
	const fovDef = opts.fovDefault ?? FOV_AT_DEFAULT_DOLLY;
	const fovFar = opts.fovMax ?? FOV_AT_MAX_DOLLY;

	const d = Number.isFinite(dolly) ? dolly : defD;
	if (d <= defD) {
		const span = Math.max(1, defD - minD);
		const t = clamp01((d - minD) / span);
		return lerp(fovNear, fovDef, t);
	}
	const span = Math.max(1, maxD - defD);
	const t = clamp01((d - defD) / span);
	return lerp(fovDef, fovFar, t);
}
