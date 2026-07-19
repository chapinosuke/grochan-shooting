// Ad-hoc: capture a boss fight with heavy bullet density (player fire held,
// special attack triggered). Takes several candidate shots over time and
// keeps the one with the most bullets on screen.
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
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
  });
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(GAME, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 400));

  const click = sel => page.evaluate(selector => document.querySelector(selector)?.click(), sel);
  const advanceStory = async (slideCount) => {
    for (let i = 0; i < slideCount; i++) {
      await click('#storyScreen'); await new Promise(r => setTimeout(r, 60));
      await click('#storyScreen'); await new Promise(r => setTimeout(r, 120));
    }
  };
  await click('#titleScreen'); await new Promise(r => setTimeout(r, 200));
  await click('#startButton'); await new Promise(r => setTimeout(r, 200));
  await advanceStory(4);
  await click('#launchButton');

  const press = (code, shift = false) => page.evaluate(({ code, shift }) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey: shift, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, shiftKey: shift, bubbles: true }));
  }, { code, shift });
  const keyDown = code => page.evaluate(c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })), code);

  const stageSkips = parseInt(process.argv[2] || '0', 10);
  await new Promise(r => setTimeout(r, 1000));
  for (let i = 0; i < stageSkips; i++) {
    await press('KeyN', true); await new Promise(r => setTimeout(r, 2600));
    await advanceStory(1);
    await click('#nextStageButton'); await new Promise(r => setTimeout(r, 400));
  }
  await press('KeyB', true);      // summon boss
  await new Promise(r => setTimeout(r, 7000)); // entrance animation

  // Hold fire continuously and also fire the special attack to fill the
  // screen with bullets/effects.
  await keyDown('Space');
  await keyDown('KeyX'); // common special-attack binding; harmless if unused

  const sampleCount = parseInt(process.argv[3] || '12', 10);
  let best = null, bestScore = -1;
  for (let i = 0; i < sampleCount; i++) {
    await new Promise(r => setTimeout(r, 400));
    await keyDown('Space');
    const d = await page.evaluate(() => window.GRO_DEBUG);
    const score = (d.playerBullets || 0) + (d.enemyBullets || 0);
    console.log('sample', i, JSON.stringify(d), 'score', score);
    if (score > bestScore) {
      bestScore = score;
      const buf = await page.screenshot();
      best = buf;
    }
  }
  const out = path.join(OUT, `shot-boss-bulletstorm-s${stageSkips}.png`);
  require('fs').writeFileSync(out, best);
  console.log('saved', out, 'bestScore', bestScore);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
