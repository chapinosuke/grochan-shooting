// Screenshot harness for visual verification of game.js changes.
// Usage:
//   node .devtools/shot.js <mode> <stageSkips>
//     mode: play | boss | mid   (default boss)
//     stageSkips: 0..4  (Shift+N skips; 0=SHIBUYA,1=AQUA,2=FACTORY,3=STORM,4=PALACE)
//   e.g.  node .devtools/shot.js play 3     -> storm gameplay w/ enemies + player fire
//         node .devtools/shot.js boss 0     -> stage1 boss
//         node .devtools/shot.js mid 2      -> factory mid-boss
// Output PNG: .devtools/shot-<mode>-s<skips>.png
//
// NOTE: headless swiftshader FPS is NOT representative — check real FPS with F1 in a real browser.
// Requires puppeteer-core (already in node_modules) + system Google Chrome.
const puppeteer = require('puppeteer-core');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GAME = 'file://' + path.join(ROOT, 'index.html');
const OUT = __dirname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=swiftshader', '--enable-webgl', '--no-sandbox', '--window-size=1280,720'],
  });
  const page = await browser.newPage();
  // The game auto-pauses when the page is hidden; headless pages are hidden, so spoof visibility.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
  });
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text()); });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(GAME, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 400));

  const click = async sel => { const el = await page.$(sel); if (el) await el.click(); };
  await click('#titleEnter'); await new Promise(r => setTimeout(r, 200));   // title -> how-to
  await click('#startButton'); await new Promise(r => setTimeout(r, 200));  // how-to -> opening
  await click('#launchButton');   // opening -> resetGame -> playing

  const press = (code, shift = false) => page.evaluate(({ code, shift }) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey: shift, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, shiftKey: shift, bubbles: true }));
  }, { code, shift });
  // Poll GRO_DEBUG until a formation is on-screen (or the idle test-player is dying).
  const pollEnemies = async () => { for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 300)); const d = await page.evaluate(() => window.GRO_DEBUG); if (d.enemies >= 7 || d.health < 50) break; } };
  await pollEnemies();
  console.log('STATE:', JSON.stringify(await page.evaluate(() => window.GRO_DEBUG)));

  const arg = process.argv[2] || 'boss';
  const stageSkips = parseInt(process.argv[3] || '0', 10);
  for (let i = 0; i < stageSkips; i++) { await press('KeyN', true); await new Promise(r => setTimeout(r, 2600)); }
  if (arg === 'play' && stageSkips > 0) await pollEnemies();
  if (arg === 'boss') { await press('KeyB', true); await new Promise(r => setTimeout(r, 7000)); }
  if (arg === 'mid') { await press('KeyM', true); await new Promise(r => setTimeout(r, 7000)); }

  // Hold fire so player bullets appear.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })));
  await new Promise(r => setTimeout(r, 500));
  console.log('STATE2:', JSON.stringify(await page.evaluate(() => window.GRO_DEBUG)));
  await page.screenshot({ path: path.join(OUT, `shot-${arg}-s${stageSkips}.png`) });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
