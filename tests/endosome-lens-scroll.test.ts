import { describe, expect, it } from 'vitest';
import {
  lensNormDist,
  lensOpacity,
  nearestSectionIndex,
  snapCentersInScroller,
} from '../src/lib/endosome-lens-scroll';

describe('endosome lens scroll math', () => {
  it('fades previous section out when snap spacing ≠ clientHeight (Chrome iOS drift)', () => {
    // clientHeight 700 but snaps are 852px apart (100dvh mismatch)
    const centers = [0, 852, 1704];
    const scrollAtSecond = 852;
    const n0 = lensNormDist(scrollAtSecond, centers[0]!, -852, centers[1]!);
    const n1 = lensNormDist(scrollAtSecond, centers[1]!, centers[0]!, centers[2]!);
    expect(lensOpacity(n0)).toBe(0);
    expect(lensOpacity(n1)).toBe(1);
  });

  it('at real snap 2, previous is fully clear when centers are measured', () => {
    const centers = [0, 852, 1704];
    const scrollY = 852;
    const prev = lensOpacity(lensNormDist(scrollY, centers[0]!, -852, centers[1]!));
    const cur = lensOpacity(lensNormDist(scrollY, centers[1]!, centers[0]!, centers[2]!));
    expect(prev).toBe(0);
    expect(cur).toBe(1);
    expect(nearestSectionIndex(scrollY, centers)).toBe(1);
  });

  it('picks nearest section from measured centers', () => {
    expect(nearestSectionIndex(800, [0, 852, 1704])).toBe(1);
    expect(nearestSectionIndex(100, [0, 852, 1704])).toBe(0);
  });

  it('reads snap offsetTops when present', () => {
    const snaps = [{ offsetTop: 0 }, { offsetTop: 900 }, { offsetTop: 1800 }];
    expect(snapCentersInScroller(snaps, 700, 6)).toEqual([0, 900, 1800]);
  });
});
