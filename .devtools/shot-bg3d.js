// bg3d.js 検証用: ?stage=N で直接開始し、道中を数秒進めてから撮る。
// 使い方: node .devtools/shot-bg3d.js <stage 1..5> [waitSec] [fastForward]
const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
(async () => {
  const stage = process.argv[2] || '1';
  const waitSec = Number(process.argv[3] || 10);
  const ff = Number(process.argv[4] || 0);      // Shift+T 回数(+30秒/回)
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-angle=swiftshader', '--enable-webgl', '--no-sandbox', '--window-size=1280,720'],
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
  });
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) console.log('PAGE-ERR:', m.text().slice(0, 200)); });
  await page.goto(`http://127.0.0.1:8123/?stage=${stage}`, { waitUntil: 'load' });
  const press = (code, shift = false) => page.evaluate(({ code, shift }) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey: shift, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, shiftKey: shift, bubbles: true }));
  }, { code, shift });
  for (let i = 0; i < ff; i++) { await press('KeyT', true); await new Promise(r => setTimeout(r, 300)); }
  await new Promise(r => setTimeout(r, waitSec * 1000));
  const st = await page.evaluate(() => window.GRO_DEBUG ? { phase: window.GRO_DEBUG.phaseId, t: Math.round(window.GRO_DEBUG.stageTime), bg3d: !!(window.GRO_BG3D && window.GRO_BG3D.ready) } : null);
  console.log('STATE:', JSON.stringify(st));
  await page.screenshot({ path: `${__dirname}/shot-bg3d-s${stage}.png` });
  await browser.close();
})();
