// FLAME OYABUN (stage 3 boss) pose harness. Jumps straight to the fight and
// captures every authored cell: idle, the four strikes pinned to their moves,
// the act-two re-entry flex, and the three-beat defeat run.
// Needs a local server: python3 -m http.server 8123
// Usage: node .devtools/shot-oyabun.js   -> .devtools/oyabun-<name>.png
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

  const shot = async name => { await page.screenshot({ path: path.join(OUT, `oyabun-${name}.png`) }); console.log('saved', name); };
  const boss = () => page.evaluate(() => window.__boss && window.__boss());

  await page.waitForFunction(() => window.__boss && window.__boss(), { timeout: 40000 });
  await page.waitForFunction(() => { const b = window.__boss(); return b && b.x <= 1280 - 40 - 300; }, { timeout: 40000 });
  await page.evaluate(() => window.__parkBoss());
  await wait(400);
  console.log('boss', JSON.stringify(await boss()));
  await shot('idle');

  // Each special pins its own strike cell. The pose only shows on the tail of
  // the windup (tel < .55), so arm a short telegraph and grab it there.
  // The strike cell only shows on the tail of a windup (tel < .55), and a
  // screenshot costs a few hundred ms, so arm a long telegraph and wait in-page
  // until the window opens rather than sleeping a guessed amount.
  for (const [type, label] of [['pillar', 'attack-pillar'], ['heatwall', 'attack-heatwall'], ['heatbeam', 'attack-heatbeam']]) {
    await page.evaluate(t => { window.__parkBoss(); window.__armTelegraph(t, 1.6); }, type);
    await page.waitForFunction(() => { const b = window.__boss(); return b && b.tel > 0.34 && b.tel < 0.5; }, { polling: 'raf', timeout: 20000 });
    // Read before the capture: a screenshot takes long enough that the boss can
    // fire the special and arm its next one, which would report the wrong pose.
    console.log(' ', label, JSON.stringify(await boss()));
    await shot(label);
    await wait(1400);
  }

  // Shoulder charge: brace, cross the floor, walk back.
  await page.evaluate(() => { window.__parkBoss(); window.__armTelegraph('charge', 1.6); });
  await page.waitForFunction(() => { const b = window.__boss(); return b && b.tel > 0.34 && b.tel < 0.5; }, { polling: 'raf', timeout: 20000 });
  await shot('charge-brace');
  await page.waitForFunction(() => { const b = window.__boss(); return b && b.mode === 'dash' && b.x < 700; }, { polling: 'raf', timeout: 20000 });
  await shot('charge-run');
  console.log('  charge-run', JSON.stringify(await boss()));
  await page.waitForFunction(() => { const b = window.__boss(); return b && b.mode === 'return'; }, { polling: 'raf', timeout: 20000 });
  await shot('charge-impact');
  await wait(1400);

  // Plain fireball / sweep use the jab and the straight punch.
  await page.evaluate(() => { window.__parkBoss(); window.__setHp(0.9); });
  await wait(1600);
  await shot('fight');

  // Act two: he returns to the arena flexing.
  await page.evaluate(() => window.__hide());
  await page.waitForFunction(() => { const b = window.__boss(); return b && b.mode === 'hover'; }, { polling: 'raf', timeout: 20000 });
  await wait(120);
  console.log('taunt state', JSON.stringify(await boss()));
  await shot('taunt');

  // Defeat run: reel -> hunch -> kneel -> fade.
  await page.evaluate(() => { window.__parkBoss(); window.__killBoss(); });
  await page.waitForFunction(() => { const b = window.__boss(); return b && b.dying > 0; }, { timeout: 20000 });
  for (const p of [0.05, 0.28, 0.5, 0.75, 0.92]) {
    await page.evaluate(v => window.__setBossDying(v), p);
    await wait(120);
    await shot(`fall-${String(p).replace('.', '')}`);
  }

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await browser.close();
})();
