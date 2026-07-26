// Staff-roll harness. Jumps straight to the credits via ?staffroll=1, reports
// the track's measured height / scroll speed, and screenshots the roll at a few
// points so every section can be read at 1x.
// Usage: node .devtools/shot-staffroll.js [shotSeconds,comma,separated]
//   -> .devtools/staffroll-<t>s.png
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GAME = 'file://' + path.join(ROOT, 'index.html?staffroll=1');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

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
  page.on('console', m => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text()); });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(GAME, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => document.querySelector('#staffRollScreen').classList.contains('is-rolling'),
    { timeout: 30000 }
  );
  const t0 = Date.now();
  const info = await page.evaluate(() => {
    const t = document.querySelector('#staffRollTrack');
    const d = getComputedStyle(t).animationDuration;
    return { height: t.offsetHeight, duration: d, pxPerSec: t.offsetHeight / parseFloat(d) };
  });
  console.log('TRACK:', JSON.stringify(info));

  const marks = (process.argv[2] || '1,8,16,24,32').split(',').map(Number);
  for (const s of marks) {
    const wait = s * 1000 - (Date.now() - t0);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const out = path.join(__dirname, `staffroll-${s}s.png`);
    await page.screenshot({ path: out });
    console.log('saved', out);
  }
  await browser.close();
})();
