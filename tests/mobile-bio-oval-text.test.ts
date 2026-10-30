import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexPath = resolve(import.meta.dirname, '../src/pages/index.astro');
const layoutPath = resolve(import.meta.dirname, '../src/layouts/Layout.astro');
const sketchPath = resolve(import.meta.dirname, '../src/components/EndosomeSketchWebGPU.astro');
const source = readFileSync(indexPath, 'utf8');
const layoutSource = readFileSync(layoutPath, 'utf8');
const sketchSource = readFileSync(sketchPath, 'utf8');
const markupEnd = source.indexOf('</Layout>');
const markup = markupEnd === -1 ? source : source.slice(0, markupEnd);

function sectionChunk(id: string): string {
  const start = markup.indexOf(`id="${id}"`);
  expect(start, `missing ${id}`).toBeGreaterThan(-1);
  const next = markup.indexOf('id="section-', start + 1);
  return next === -1 ? markup.slice(start) : markup.slice(start, next);
}

describe('mobile bio oval text markup contract', () => {
  it('puts oval-flow carves + pole spacers on sections 1–4 and What now (6)', () => {
    for (const id of ['section-1', 'section-2', 'section-3', 'section-4', 'section-6']) {
      const chunk = sectionChunk(id);
      expect(chunk, id).toContain('oval-flow');
      expect(chunk, id).toContain('oval-carve carve-left');
      expect(chunk, id).toContain('oval-carve carve-right');
      expect(chunk, id).toContain('oval-spacer-top');
      expect(chunk, id).toContain('oval-spacer-bottom');
    }
  });

  it('keeps Becoming (5) free of carve markup', () => {
    const chunk = sectionChunk('section-5');
    expect(chunk).not.toContain('oval-carve');
    expect(chunk).not.toContain('oval-flow');
  });

  it('uses full-ellipse carves with floored poles and content-synced height', () => {
    expect(source).toContain('syncOvalCarveHeights');
    expect(source).toContain('70% 0%');
    expect(source).toContain('70% 100%');
    expect(source).toContain('30% 0%');
    expect(source).toContain('30% 100%');
    expect(source).toMatch(/--oval-flow-w:\s*8[0-9]%/);
  });

  it('gates oval carve craft to body.is-mobile (desktop unwraps to deployed layout)', () => {
    expect(source).toMatch(/body\.is-mobile\s+\.oval-carve/);
    expect(source).toMatch(/body\.is-desktop\s+\.oval-flow\s*\{\s*display:\s*contents/);
    expect(source).toMatch(/body\.is-desktop\s+\.oval-carve[\s\S]*display:\s*none/);
    expect(source).toMatch(/body\.is-desktop\s+\.name-title\s*\{\s*font-size:\s*2rem/);
    expect(source).toMatch(
      /narrowMobile[\s\S]*is-mobile|is-mobile[\s\S]*narrowMobile/,
    );
    // Recreate main's max-w-3xl paragraph measure on desktop
    expect(source).toMatch(/max-width:\s*48rem/);
    // Desktop title uses system mono (deployed never loaded Ubuntu Mono)
    expect(source).toMatch(
      /body\.is-desktop\s+\.name-title\s*\{[\s\S]*?SF Mono/,
    );
  });

  it('couples mobile charcoal stroke to the bubble layout box (not bare 100vh)', () => {
    // iOS: 100vh (large viewport) ≠ innerHeight/dvh → stroke CSS box stretches and
    // drifts below bubble-centered text. Sketch must fill the layout viewport only.
    const sketchCss = sketchSource.slice(
      sketchSource.indexOf('.endosome-sketch'),
      sketchSource.indexOf('#endosome-canvas'),
    );
    expect(sketchCss).toMatch(/inset:\s*0/);
    expect(sketchCss).not.toMatch(/height:\s*100vh/);
    expect(sketchCss).not.toMatch(/width:\s*100vw/);

    // Mobile shader must track content_pos (bubble center), not ignore it.
    expect(sketchSource).toMatch(/MOBILE:\s*Track bubble\/content position/);
    expect(sketchSource).not.toMatch(/Mobile: p stays centered at \(0,0\) - no offset applied/);

    // Text nudge targets the same bubble the sketch observes.
    expect(source).toMatch(/targetCy[\s\S]*bubble|bubble[\s\S]*targetCy/);
  });

  it('keeps mobile-detect inside Layout <body> (never after </Layout>/</html>)', () => {
    // Scripts after </Layout> are emitted after </html>. Without is-mobile,
    // .content-wrapper never becomes the scroller and oval carves stay off —
    // broken scroll + wrong text shape on phones (worse with CF challenge inject).
    const bodyOpen = layoutSource.indexOf('<body');
    const bodyClose = layoutSource.lastIndexOf('</body>');
    const mobileDetect = layoutSource.indexOf('ROBUST MOBILE DETECTION');
    expect(mobileDetect, 'mobile detect must live in Layout.astro').toBeGreaterThan(-1);
    expect(mobileDetect).toBeGreaterThan(bodyOpen);
    expect(mobileDetect).toBeLessThan(bodyClose);
    expect(source).not.toContain('ROBUST MOBILE DETECTION');
  });

  it('keeps home lens module inside Layout so Astro does not emit it after </html>', () => {
    const layoutClose = source.indexOf('</Layout>');
    const lensImport = source.indexOf("from '../lib/endosome-lens-scroll'");
    expect(layoutClose).toBeGreaterThan(-1);
    expect(lensImport).toBeGreaterThan(-1);
    expect(lensImport).toBeLessThan(layoutClose);
  });
});
