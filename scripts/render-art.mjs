// Renders public/art/*.svg to PNG with the preinstalled Chromium.
//   node scripts/render-art.mjs preview <outDir>   -> contact sheet + per-art PNGs for review
//   node scripts/render-art.mjs android            -> notification images + launcher icons
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const artDir = join(root, 'public/art');
const mode = process.argv[2] ?? 'android';
const exe = ['/opt/pw-browsers/chromium', process.env.CHROMIUM_PATH].find((p) => p && existsSync(p));

function findChromium() {
  if (exe && !exe.endsWith('/chromium')) return exe;
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  for (const d of readdirSync(base)) {
    for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome']) {
      const p = join(base, d, rel);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage();
const arts = readdirSync(artDir).filter((f) => f.endsWith('.svg')).map((f) => f.replace('.svg', ''));

async function shot(html, w, h, out) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:#000">${html}</body></html>`);
  await page.waitForTimeout(50);
  writeFileSync(out, await page.screenshot({ type: 'png' }));
}

const dataUri = (name) => `data:image/svg+xml;base64,${readFileSync(join(artDir, name + '.svg')).toString('base64')}`;
const img = (name, w, h, pos = '50% 40%') =>
  `<img src="${dataUri(name)}" style="width:${w}px;height:${h}px;object-fit:cover;object-position:${pos};display:block">`;

if (mode === 'preview') {
  const out = process.argv[3] ?? '/tmp';
  mkdirSync(out, { recursive: true });
  const only = process.argv[4]?.split(',');
  const list = only ?? arts;
  const cells = list
    .map((a) => `<div style="display:inline-block;margin:4px;color:#fff;font:14px sans-serif">${img(a, 300, 300)}<div>${a}</div></div>`)
    .join('');
  await shot(`<div style="width:${Math.min(list.length, 4) * 308}px">${cells}</div>`, Math.min(list.length, 4) * 308 + 8, Math.ceil(list.length / 4) * 330 + 8, join(out, 'sheet.png'));
  // phone-shaped crop of each, to check what survives on a portrait screen
  const phones = list.map((a) => `<div style="display:inline-block;margin:4px">${img(a, 180, 390, '50% 35%')}</div>`).join('');
  await shot(`<div>${phones}</div>`, list.length * 188 + 8, 400, join(out, 'phones.png'));
} else {
  const res = join(root, 'android/app/src/main/res');
  const nodpi = join(res, 'drawable-nodpi');
  mkdirSync(nodpi, { recursive: true });
  for (const a of arts) await shot(img(a, 720, 360, '50% 42%'), 720, 360, join(nodpi, `art_${a}.png`));
  const icon = `data:image/svg+xml;base64,${readFileSync(join(root, 'public/icon.svg')).toString('base64')}`;
  const fg = `data:image/svg+xml;base64,${readFileSync(join(root, 'public/icon-foreground.svg')).toString('base64')}`;
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, px] of Object.entries(sizes)) {
    const dir = join(res, `mipmap-${d}`);
    mkdirSync(dir, { recursive: true });
    await shot(`<img src="${icon}" style="width:${px}px;height:${px}px;display:block">`, px, px, join(dir, 'ic_launcher.png'));
    await shot(`<img src="${icon}" style="width:${px}px;height:${px}px;display:block;border-radius:50%">`, px, px, join(dir, 'ic_launcher_round.png'));
    const fpx = Math.round((px * 108) / 48);
    await shot(`<img src="${fg}" style="width:${fpx}px;height:${fpx}px;display:block">`, fpx, fpx, join(dir, 'ic_launcher_foreground.png'));
  }
  // Splash screens: icon centered on the app background.
  for (const d of readdirSync(res).filter((x) => x.startsWith('drawable'))) {
    const f = join(res, d, 'splash.png');
    if (!existsSync(f)) continue;
    const buf = readFileSync(f);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const px = Math.round(Math.min(w, h) * 0.28);
    await shot(
      `<div style="width:${w}px;height:${h}px;background:#0f1419;display:flex;align-items:center;justify-content:center"><img src="${icon}" style="width:${px}px;height:${px}px"></div>`,
      w,
      h,
      f,
    );
  }
  for (const px of [192, 512]) await shot(`<img src="${icon}" style="width:${px}px;height:${px}px;display:block">`, px, px, join(root, `public/icon-${px}.png`));
}
await browser.close();
