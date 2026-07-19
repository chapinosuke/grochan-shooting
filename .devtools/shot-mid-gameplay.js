// Ad-hoc: capture actual mid-stage gameplay (enemies + bullets visible),
// not just the stage title card. Skips to a later stage then waits for
// the banner to clear and a real formation to spawn before screenshotting.
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

  const stageSkips = parseInt(process.argv[2] || '2', 10);
  await new Promise(r => setTimeout(r, 1500)); // let stage 0 settle first
  for (let i = 0; i < stageSkips; i++) {
    await press('KeyN', true); await new Promise(r => setTimeout(r, 2600));
    await advanceStory(1);
    await click('#nextStageButton'); await new Promise(r => setTimeout(r, 400));
  }
  // Wait out the stage title banner, then hold fire and poll until a real
  // formation with visible bullets is on screen (ignore health this time).
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })));
  let last;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    last = await page.evaluate(() => window.GRO_DEBUG);
    if (last.enemies >= 3 && last.playerBullets >= 1) break;
  }
  console.log('STATE:', JSON.stringify(last));
  const out = path.join(OUT, `shot-mid-gameplay-s${stageSkips}.png`);
  await page.screenshot({ path: out });
  await browser.close();
  console.log('saved', out);
})().catch(e => { console.error(e); process.exit(1); });
