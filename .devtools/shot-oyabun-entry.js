// FLAME OYABUN run-up: everything before and into the fight, with nothing
// parked or forced. Captures the boss-warning beat, the slide-in from the right
// edge, the moment he settles, and the opening exchanges.
// Needs a local server: python3 -m http.server 8123
// Usage: node .devtools/shot-oyabun-entry.js  -> .devtools/oyabun-entry-*.png
const puppeteer = require('puppeteer-core');
const path = require('path');
const GAME = 'http://127.0.0.1:8123/?boss=3&power=3&wide=3&max=1';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = __dirname;
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=swiftshader', '--enable-webgl', '--no-sandbox', '--window-size=1280,720'],
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
  });
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto(GAME, { waitUntil: 'load' });

  const shot = async name => { await page.screenshot({ path: path.join(OUT, `oyabun-entry-${name}.png`) }); console.log('saved', name); };
  const state = () => page.evaluate(() => ({ ...window.GRO_DEBUG, boss: window.__boss && window.__boss() }));

  // The warning siren plays before the boss exists at all.
  await page.waitForFunction(() => window.GRO_DEBUG && window.GRO_DEBUG.bossState === 'warning', { polling: 'raf', timeout: 40000 });
  await wait(120);
  console.log('warning', JSON.stringify(await state()));
  await shot('warning');

  // Slide-in: he spawns off the right edge and walks his box into frame.
  await page.waitForFunction(() => window.__boss && window.__boss(), { polling: 'raf', timeout: 40000 });
  for (const label of ['enter-1', 'enter-2', 'enter-3']) {
    await shot(label);
    console.log(label, JSON.stringify((await state()).boss));
    await wait(420);
  }

  // Settled at his park position, fighting for real.
  await page.waitForFunction(() => { const b = window.__boss(); return b && b.x <= 1280 - 40 - 300; }, { polling: 'raf', timeout: 40000 });
  await wait(600);
  console.log('engaged', JSON.stringify((await state()).boss));
  await shot('engaged');
  for (let i = 1; i <= 4; i++) { await wait(900); await shot(`fight-${i}`); }

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await browser.close();
})();
