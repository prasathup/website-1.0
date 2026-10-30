import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexSource = readFileSync(
  resolve(import.meta.dirname, '../src/pages/index.astro'),
  'utf8',
);

describe('desktop bio mouse-wheel snap contract', () => {
  it('keeps document scroll on html only (body must not eat mouse-wheel)', () => {
    // Layout sets overflow-x:hidden on body → overflow-y computes to auto.
    // A body scrollport with scrollHeight===clientHeight swallows discrete
    // mouse-wheel while keyboard/trackpad still move documentElement.
    expect(indexSource).toMatch(
      /html:has\(body\.page-home\.is-desktop\)\s*\{[\s\S]*?overflow-y:\s*auto/,
    );
    expect(indexSource).toMatch(
      /body\.page-home\.is-desktop\s*\{[\s\S]*?overflow:\s*visible\s*!important/,
    );
    expect(indexSource).not.toMatch(
      /body\.page-home\.is-desktop\s*\{[\s\S]*?overflow-y:\s*auto\s*!important/,
    );
  });

  it('disables CSS scroll-snap on desktop home (keeps snap nodes for lens measure)', () => {
    expect(indexSource).toMatch(
      /html:has\(body\.page-home\.is-desktop\)\s*\{[\s\S]*?scroll-snap-type:\s*none/,
    );
    expect(indexSource).not.toMatch(/scroll-snap-type:\s*y\s+mandatory/);

    expect(indexSource).toMatch(
      /body\.is-mobile\s+\.snap-section\s*\{[\s\S]*?scroll-snap-align:\s*start/,
    );
    expect(indexSource).toMatch(
      /body\.is-desktop\s+\.snap-section\s*\{[\s\S]*?scroll-snap-align:\s*none/,
    );
  });

  it('avoids thrashing section styles every RAF (desktop mouse-wheel)', () => {
    // Threshold flicker on visibility/pointer-events stalls Chromium document wheel.
    // Desktop must never write those (or transform) in tick — mobile-only.
    expect(indexSource).toContain('function setStyleProp');
    const tick = indexSource.slice(
      indexSource.indexOf('function tick()'),
      indexSource.indexOf('function handleReducedMotion'),
    );
    const tickWithoutMobile = tick.replace(
      /if\s*\(\s*isMobileMode\s*\)\s*\{[\s\S]*?\n\s*\}/g,
      '',
    );
    expect(tickWithoutMobile).not.toMatch(/setStyleProp\(\s*section,\s*'visibility'/);
    expect(tickWithoutMobile).not.toMatch(/setStyleProp\(\s*section,\s*'pointerEvents'/);
    expect(tickWithoutMobile).not.toMatch(/setStyleProp\(\s*section,\s*'transform'/);

    const mobileBlocks = [...tick.matchAll(/if\s*\(\s*isMobileMode\s*\)\s*\{([\s\S]*?)\n\s*\}/g)];
    const mobileBody = mobileBlocks.map((m) => m[1]).join('\n');
    expect(mobileBody).toMatch(/setStyleProp\(\s*section,\s*'visibility'/);
    expect(mobileBody).toMatch(/setStyleProp\(\s*section,\s*'pointerEvents'/);
    expect(mobileBody).toMatch(/setStyleProp\(\s*section,\s*'transform'/);
  });
});
