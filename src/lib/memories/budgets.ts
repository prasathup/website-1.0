/**
 * Hard runtime budgets for memory spheres (desktop vs mobile).
 * Pure helpers — safe to unit test without DOM.
 */

export interface DeviceBudgets {
	nearOrbCount: number;
	texturedOrbs: number;
	focusSlots: number;
	concurrency: number;
	ghostProjectedPx: number;
}

export function isMobileViewport(width: number): boolean {
	return width <= 640;
}

export function getDeviceBudgets(width: number): DeviceBudgets {
	if (isMobileViewport(width)) {
		return {
			nearOrbCount: 16,
			texturedOrbs: 16,
			focusSlots: 1,
			concurrency: 3,
			ghostProjectedPx: 48
		};
	}
	if (width <= 1024) {
		return {
			nearOrbCount: 20,
			texturedOrbs: 28,
			focusSlots: 1,
			concurrency: 4,
			ghostProjectedPx: 40
		};
	}
	return {
		nearOrbCount: 22,
		texturedOrbs: 32,
		focusSlots: 1,
		concurrency: 5,
		ghostProjectedPx: 36
	};
}

/**
 * Priority for LOD upgrades: projected screen size × center proximity × interaction boost.
 */
export function scoreLodPriority(
	projectedPx: number,
	distFromViewCenter01: number,
	interactionBoost = 1
): number {
	const sizeTerm = Math.max(0, projectedPx);
	const centerTerm = 1 - Math.min(1, Math.max(0, distFromViewCenter01));
	return sizeTerm * (0.35 + 0.65 * centerTerm) * interactionBoost;
}

export function assignDepthBand(
	index: number,
	nearBudget: number
): 'near' | 'deep' {
	return index < nearBudget ? 'near' : 'deep';
}

/** Soft Z bands in world units (camera looks down −Z). */
export const NEAR_Z_MIN = -120;
export const NEAR_Z_MAX = 40;
export const DEEP_Z_MIN = -1800;
export const DEEP_Z_MAX = -280;

export function sampleNearZ(random: () => number): number {
	return NEAR_Z_MIN + random() * (NEAR_Z_MAX - NEAR_Z_MIN);
}

export function sampleDeepZ(random: () => number): number {
	return DEEP_Z_MIN + random() * (DEEP_Z_MAX - DEEP_Z_MIN);
}
