/**
 * Frame duration helpers for ImageDecoder / WebP glass playback.
 * VideoFrame.duration is microseconds; some engines may surface ms-scale values.
 */

/** Nominal 24fps frame length. */
export const GLASS_FRAME_MS_24 = 1000 / 24;

/**
 * Normalize a decoder duration to milliseconds, clamped for stable 24fps playback.
 */
export function normalizeGlassFrameDurationMs(rawDuration: number | null | undefined): number {
	if (rawDuration == null || !Number.isFinite(rawDuration) || rawDuration <= 0) {
		return GLASS_FRAME_MS_24;
	}
	// Microseconds (WebCodecs): ~20_000–80_000 for ~12–50fps
	if (rawDuration >= 1000) {
		return Math.min(100, Math.max(20, rawDuration / 1000));
	}
	// Already milliseconds (or sub-ms noise)
	return Math.min(100, Math.max(20, rawDuration));
}
