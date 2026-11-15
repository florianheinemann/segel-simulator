// Erzeugt App-Icons und iOS-Startbilder aus public/icon.svg.
// Aufruf: node scripts/gen-assets.cjs   (benötigt Playwright mit Chromium)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');
const svg = fs.readFileSync(path.join(pub, 'icon.svg'), 'utf8');
const devices = JSON.parse(fs.readFileSync(path.join(root, 'splash.json'), 'utf8'));

(async () => {
  const b = await chromium.launch();
  const shot = async (w, h, html, file) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.setContent(html);
    await p.screenshot({ path: path.join(pub, file) });
    await p.close();
  };
  for (const n of [180, 192, 512])
    await shot(n, n, `<style>body{margin:0}svg{width:${n}px;height:${n}px;display:block}</style>${svg}`, `icon-${n}.png`);

  fs.mkdirSync(path.join(pub, 'splash'), { recursive: true });
  const splash = (w, h) => {
    const s = Math.round(Math.min(w, h) * 0.3);
    return `<style>body{margin:0;height:100vh;background:#0b2f4a;display:flex;flex-direction:column;align-items:center;justify-content:center;
      font:600 ${Math.round(s * 0.2)}px -apple-system,"Segoe UI",Roboto,sans-serif;color:#f2f6f9}
      svg{width:${s}px;height:${s}px;border-radius:22%;margin-bottom:${Math.round(s * 0.14)}px}</style>${svg}Segel-Simulator`;
  };
  for (const d of devices) {
    const W = d.w * d.dpr, H = d.h * d.dpr;
    await shot(W, H, splash(W, H), `splash/${W}x${H}.png`);
    await shot(H, W, splash(H, W), `splash/${H}x${W}.png`);
  }
  await b.close();
})();
