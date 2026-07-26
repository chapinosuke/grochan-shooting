// Screenshot harness for visual verification of game.js changes.
// Usage:
//   node .devtools/shot.js <mode> <stageSkips>
//     mode: play | roster | boss | mid | setpiece   (default boss)
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
// The game requires a local server for same-origin sprite reads and LOCAL_DEV
// art hooks. Start tmp/serve.py (or python -m http.server 8123) first.
const GAME = 'http://127.0.0.1:8123/';
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

  // Dispatch DOM clicks so delayed CSS entrance animations do not make the
  // deterministic harness wait on an otherwise-ready control.
  const click = sel => page.evaluate(selector => document.querySelector(selector)?.click(), sel);
  // A story slide needs one action to finish its typewriter text and another
  // to advance. Keep waits short: the harness wants the final layout, not the
  // typing animation itself.
  const advanceStory = async (slideCount) => {
    for (let i = 0; i < slideCount; i++) {
      await click('#storyScreen'); await new Promise(r => setTimeout(r, 60));
      await click('#storyScreen'); await new Promise(r => setTimeout(r, 120));
    }
  };
  await click('#titleScreen'); await new Promise(r => setTimeout(r, 200));  // title -> how-to
  await click('#startButton'); await new Promise(r => setTimeout(r, 200));  // how-to -> opening story
  await advanceStory(4);                                                    // opening story -> mission card
  await click('#launchButton');   // opening -> resetGame -> playing

  const press = (code, shift = false) => page.evaluate(({ code, shift }) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey: shift, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, shiftKey: shift, bubbles: true }));
  }, { code, shift });
  // Poll GRO_DEBUG until a formation is on-screen (or the idle test-player is dying).
  const pollEnemies = async (ignoreHealth = false) => { for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 300)); const d = await page.evaluate(() => window.GRO_DEBUG); if (d.enemies >= 7 || (!ignoreHealth && d.health < 50)) break; } };
  await pollEnemies();
  console.log('STATE:', JSON.stringify(await page.evaluate(() => window.GRO_DEBUG)));

  const arg = process.argv[2] || 'boss';
  const stageSkips = parseInt(process.argv[3] || '0', 10);
  // Shift+N runs the clear transition, which now opens the between-stage shop —
  // leave it via its button (or Enter) before the next skip.
  for (let i = 0; i < stageSkips; i++) {
    await press('KeyN', true); await new Promise(r => setTimeout(r, 2600));
    await advanceStory(1);  // cleared-stage interlude -> shop
    await click('#nextStageButton'); await new Promise(r => setTimeout(r, 400));
  }
  // Damage carried from stage 1 must not make a later-stage play shot stop
  // polling before that stage has spawned anything.
  if (arg === 'play' && stageSkips > 0) await pollEnemies(true);
  if (arg === 'shop') {
    await press('KeyN', true); await new Promise(r => setTimeout(r, 2900));
    await advanceStory(1);  // clear transition -> interlude -> shop overlay
  }
  if (arg === 'boss') { await press('KeyB', true); await new Promise(r => setTimeout(r, 7000)); }
  if (arg === 'mid') { await press('KeyM', true); await new Promise(r => setTimeout(r, 7000)); }
  if (arg === 'setpiece') {
    // Enter and immediately clear the mid-boss through its normal debug kill
    // path, then jump 30 seconds into the post-mid route (the set-piece phase).
    await press('KeyM', true); await new Promise(r => setTimeout(r, 3600));
    await press('KeyM', true); await new Promise(r => setTimeout(r, 500));
    await press('KeyT', true); await new Promise(r => setTimeout(r, 2200));
  }
  if (arg === 'roster') {
    const rosters = [
      [['crow', 720, 120], ['neonmoth', 930, 270], ['alleycat', 740, 535]],
      [['dumbo', 720, 110], ['angler', 930, 275], ['moray', 650, 485]],
      [['rivetbeetle', 720, 120], ['slagling', 930, 520], ['furnacehound', 690, 500]],
      [['cloudray', 710, 120], ['voltbug', 940, 285], ['packetwyrm', 700, 485]],
      [['rosebud', 720, 110], ['cardguard', 930, 500], ['teacup', 720, 545]],
    ];
    await page.evaluate(list => {
      window.__clearEnemies();
      for (const [type, x, y] of list) window.__spawn(type, x, y, true);
    }, rosters[stageSkips]);
    // Stage skips leave a mission card over the playfield for roughly two
    // seconds; wait it out so the roster art is actually visible in the shot.
    await new Promise(r => setTimeout(r, 2400));
  }

  // Hold fire so player bullets appear.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })));
  await new Promise(r => setTimeout(r, 500));
  console.log('STATE2:', JSON.stringify(await page.evaluate(() => window.GRO_DEBUG)));
  await page.screenshot({ path: path.join(OUT, `shot-${arg}-s${stageSkips}.png`) });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
