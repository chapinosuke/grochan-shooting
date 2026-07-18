// Title-screen screenshot: loads the game and captures the menu state
// (canvas-drawn logo + attract-mode Gro-chan + HTML bottom panel).
// Usage: node .devtools/shot-title.js [waitMs]  -> .devtools/shot-title.png
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
  await new Promise(r => setTimeout(r, Number(process.argv[2] || 2500)));
  console.log('STATE:', JSON.stringify(await page.evaluate(() => window.GRO_DEBUG)));
  await page.screenshot({ path: path.join(__dirname, 'shot-title.png') });
  await browser.close();
  console.log('saved .devtools/shot-title.png');
})();
