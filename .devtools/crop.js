// Zoom into a region of a screenshot for detail inspection (enemies are small at 1x).
// Usage: node .devtools/crop.js <png> <cx> <cy> <cw> <ch>
//   crops (cx,cy,cw,ch) from the PNG and writes a 3x nearest-neighbor zoom to crop-out.png
// e.g. node .devtools/crop.js .devtools/shot-play-s0.png 940 360 330 130
const puppeteer = require('puppeteer-core');
const fs = require('fs'); const path = require('path');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const data = 'data:image/png;base64,' + fs.readFileSync(process.argv[2]).toString('base64');
  const [cx, cy, cw, ch] = process.argv.slice(3, 7).map(Number);
  const Z = 3;
  await p.setViewport({ width: cw * Z, height: ch * Z, deviceScaleFactor: 1 });
  await p.setContent(`<body style="margin:0"><canvas id=c width=${cw * Z} height=${ch * Z}></canvas></body>`);
  await p.evaluate(({ data, cx, cy, cw, ch, Z }) => new Promise(res => {
    const i = new Image();
    i.onload = () => { const g = document.getElementById('c').getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(i, cx, cy, cw, ch, 0, 0, cw * Z, ch * Z); res(); };
    i.src = data;
  }), { data, cx, cy, cw, ch, Z });
  await p.screenshot({ path: path.resolve(path.dirname(__filename), 'crop-out.png') });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
