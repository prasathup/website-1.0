import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const headersPath = resolve(import.meta.dirname, '../public/_headers');
const headers = readFileSync(headersPath, 'utf8');

describe('Cloudflare Pages _headers cache contract', () => {
  it('does not apply immutable long-cache to /_astro/* (prevents soft-404 HTML poison)', () => {
    // Pages serves index.html (200) for unknown /_astro/* paths. If _headers then
    // stamps Cache-Control: immutable, the CDN can cache HTML under the JS URL.
    // Module script requests include Origin and hit that poisoned entry on the
    // custom domain — lens never loads → scroll/oval craft break on apex only.
    // Only count real path blocks (line starting with /_astro/), not comments.
    const astroBlocks = [
      ...headers.matchAll(/(?:^|\n)(\/_astro\/\*[^\n]*\n(?:[ \t]+[^\n]*\n)*)/g),
    ].map((m) => m[1]);
    expect(astroBlocks.join('')).not.toMatch(/Cache-Control:\s*[^\n]*immutable/i);
    expect(headers).toMatch(/Do NOT set long-lived \/ immutable Cache-Control on \/_astro/);
  });
});
