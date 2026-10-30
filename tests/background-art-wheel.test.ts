import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(import.meta.dirname, '../src/components/BackgroundImages.astro'),
  'utf8',
);

describe('background art wheel hijack contract', () => {
  it('focuses artwork via wheel in art zones on home/bio (no blanket skip)', () => {
    const wheelFn = source.slice(
      source.indexOf('function handleWheel'),
      source.indexOf('function handleMouseMove'),
    );

    // Zone-only hijack is the reveal control — must stay on home/bio.
    expect(wheelFn).toContain('isInArtZone');
    expect(wheelFn).toContain('preventDefault');
    expect(wheelFn).toContain('targetFocus');
    expect(wheelFn).toMatch(/clientX\s*\|\|\s*state\.mouseX/);

    // Over-correction that killed art reveal on desktop/iPad:
    expect(wheelFn).not.toMatch(
      /page\s*===\s*['"]home['"]\s*\|\|\s*page\s*===\s*['"]bio['"]\s*\)\s*return/,
    );
  });
});
