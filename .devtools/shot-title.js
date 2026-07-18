// Menu screenshot: captures the title or how-to-play step of the menu flow.
// Usage: node .devtools/shot-title.js [title|howto] [waitMs]
//   -> .devtools/shot-title.png / shot-howto.png
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GAME = 'file://' + path.join(ROOT, 'index.html');
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
  const mode = process.argv[2] === 'howto' ? 'howto' : 'title';
  if (mode === 'howto') { const el = await page.$('#titleEnter'); if (el) await el.click(); }
  await new Promise(r => setTimeout(r, Number(process.argv[3] || 2500)));
  console.log('STATE:', JSON.stringify(await page.evaluate(() => window.GRO_DEBUG)));
  const out = path.join(__dirname, `shot-${mode}.png`);
  await page.screenshot({ path: out });
  await browser.close();
  console.log('saved', out);
})();
