/** Authored motion assumes ~60fps (Safari calm feel). */
export const REF_FPS = 60;
export const REF_DT_SEC = 1 / REF_FPS;

/**
 * Wall-clock dt → multiplier vs one 60fps frame.
 * Cap softens tab-resume / hitch spikes without freezing motion.
 */
export function frameScale(dtSec: number, maxFrames = 2.5): number {
	if (!Number.isFinite(dtSec) || dtSec <= 0) return 1;
	return Math.min(maxFrames, dtSec * REF_FPS);
}

/** Exponential lerp factor authored for 60fps, scaled to actual frame count. */
export function lerpFactor(k60: number, frames: number): number {
	if (frames <= 0 || k60 <= 0) return 0;
	if (k60 >= 1) return 1;
	return 1 - Math.pow(1 - k60, frames);
}
