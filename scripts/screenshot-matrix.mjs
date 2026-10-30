// Screenshot matrix for the home page endosome sections.
// Usage: node scripts/screenshot-matrix.mjs --out screenshots/baseline [--url http://localhost:4321]
// Assumes a server is already running (astro dev or astro preview).
import { chromium, webkit } from 'playwright';
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    out: { type: 'string', default: 'screenshots/run' },
    url: { type: 'string', default: 'http://localhost:4321' },
  },
});

const DEVICES = [
  { name: 'iphone-se',      width: 375,  height: 667,  mobile: true },
  { name: 'iphone-15-pro',  width: 393,  height: 852,  mobile: true },
  { name: 'pixel-7',        width: 412,  height: 915,  mobile: true },
  { name: 'ipad-portrait',  width: 820,  height: 1180, mobile: true },
  { name: 'ipad-landscape', width: 1180, height: 820,  mobile: true },
  { name: 'laptop',         width: 1440, height: 900,  mobile: false },
  { name: 'desktop',        width: 1920, height: 1080, mobile: false },
];

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const THEMES = (process.env.SHOT_THEMES ?? 'light,dark').split(',');
const SECTIONS = (process.env.SHOT_SECTIONS ?? '1,2,3,4,5,6').split(',').map(Number);

mkdirSync(args.out, { recursive: true });

for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  for (const device of DEVICES) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        userAgent: device.mobile ? MOBILE_UA : undefined,
        hasTouch: device.mobile,
        isMobile: device.mobile && engineName === 'chromium', // webkit doesn't support isMobile
        colorScheme: theme === 'dark' ? 'dark' : 'light',
      });
      const page = await context.newPage();
      await page.goto(args.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500); // fonts + renderer warmup

      for (const section of SECTIONS) {
        await page.evaluate((idx) => {
          const scroller = document.querySelector('.content-wrapper');
          const h = scroller && scroller.scrollHeight > scroller.clientHeight
            ? scroller.clientHeight
            : window.innerHeight;
          const top = (idx - 1) * h;
          if (scroller && scroller.scrollHeight > scroller.clientHeight) {
            scroller.scrollTo({ top, behavior: 'instant' });
          } else {
            window.scrollTo({ top, behavior: 'instant' });
          }
        }, section);
        await page.waitForTimeout(900); // lens engine settle
        await page.screenshot({
          path: `${args.out}/${engineName}-${device.name}-${theme}-s${section}.png`,
        });
      }
      await context.close();
    }
  }
  await browser.close();
  console.log(`${engineName} done`);
}
console.log(`Screenshots written to ${args.out}`);
