/**
 * Continuous lens focus math for the home bio bubble.
 * Centers must be measured from .snap-section positions — do not assume
 * index * viewportH (Chrome iOS clientHeight vs 100dvh drift causes overlap).
 */

export function lensNormDist(
  scrollY: number,
  centerY: number,
  prevCenter: number,
  nextCenter: number,
): number {
  const dist = scrollY - centerY;
  const span = dist >= 0 ? nextCenter - centerY : centerY - prevCenter;
  if (!(span > 0)) return dist === 0 ? 0 : Math.sign(dist);
  return dist / span;
}

/** Bell fade: 1 at center, 0 by |normDist| >= fadeRadius */
export function lensOpacity(normDist: number, fadeRadius = 0.65): number {
  const t = Math.abs(normDist) / fadeRadius;
  return Math.max(0, Math.min(1, 1 - t * t));
}

export function nearestSectionIndex(scrollY: number, centers: number[]): number {
  if (!centers.length) return 0;
  let best = 0;
  let bestDist = Math.abs(scrollY - centers[0]!);
  for (let i = 1; i < centers.length; i++) {
    const d = Math.abs(scrollY - centers[i]!);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Snap tops relative to a scroll container (mobile inner scroller). */
export function snapCentersInScroller(
  snaps: ArrayLike<{ offsetTop: number }>,
  fallbackVh: number,
  count: number,
): number[] {
  if (snaps.length > 0) {
    return Array.from(snaps, (el) => el.offsetTop);
  }
  return Array.from({ length: count }, (_, i) => i * fallbackVh);
}
