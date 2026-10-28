/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script run directly with node */
// Renders the source art in mobile/assets (icon and splash) from public/icon.svg; then run
// npx capacitor-assets generate --assetPath mobile/assets (see mobile/README.md).
const { chromium } = require("playwright");
const fs = require("fs");
const svg = fs.readFileSync(process.argv[2], "utf8").replace(/<metadata>[\s\S]*?<\/metadata>/, "");
const out = process.argv[3];
const mark = (s) => svg.replace("<svg", `<svg width="${s}" height="${s}"`);
// Glyph only (no green tile), for the adaptive-icon foreground and the splash.
const glyph = (s, color) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><circle cx="30" cy="30" r="18" fill="none" stroke="${color}" stroke-width="4"/><path d="M43.2 43.2L51 51" stroke="${color}" stroke-width="5.5" stroke-linecap="round"/><rect x="20.5" y="31" width="4.6" height="10" rx="1.2" fill="${color}"/><rect x="27.7" y="25" width="4.6" height="16" rx="1.2" fill="${color}"/><rect x="34.9" y="19" width="4.6" height="22" rx="1.2" fill="${color}"/></svg>`;
(async () => {
  const br = await chromium.launch();
  const p = await br.newPage();
  const shot = async (w, h, body, file, bg = "transparent") => {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;background:${bg};display:grid;place-items:center">${body}</body></html>`);
    await p.screenshot({ path: `${out}/${file}`, omitBackground: bg === "transparent" });
  };
  await shot(1024, 1024, mark(1024), "icon-only.png", "#076339");
  await shot(1024, 1024, glyph(560, "#ffffff"), "icon-foreground.png");
  await shot(1024, 1024, "", "icon-background.png", "#076339");
  const splash = (bg, word) => `<div style="display:flex;flex-direction:column;align-items:center;gap:56px">${mark(420)}<div style="font:600 112px system-ui,sans-serif;color:${word}">Refinery<span style="color:#087c47;font-weight:300">Lens</span></div></div>`;
  await shot(2732, 2732, splash("#ffffff", "#0b1530"), "splash.png", "#ffffff");
  await shot(2732, 2732, splash("#0b1530", "#ffffff"), "splash-dark.png", "#0b1530");
  await br.close();
})();
