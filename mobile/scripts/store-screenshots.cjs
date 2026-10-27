/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script run directly with node */
// Captures framed store screenshots (App Store 6.7" iPhone and Google Play phone) and the Play feature graphic from a
// running RefineryLens. Usage: BASE_URL=https://your-site node mobile/scripts/store-screenshots.cjs mobile/store/screenshots public/icon.svg
// Sign-in uses STORE_SHOT_EMAIL / STORE_SHOT_PASSWORD (defaults to the demo buyer). Needs Playwright with Chromium.
const { chromium } = require("playwright");
const fs = require("fs");
const B = process.env.BASE_URL ?? "http://localhost:3000";
const out = process.argv[2];
const SCREENS = [
  ["01-hub", "/hub", "Buy, sell and deliver fuel and gas", "Verified businesses across Nigeria", 'nav[aria-label="Quick actions"]'],
  ["02-prices", "/hub/prices?item=lpg_retail_kg", "Today's prices, state by state", "LPG, diesel, petrol and CNG medians", "#board-h"],
  ["03-gas", "/hub/gas?state=Kano", "Find gas near you", "Refill plants, depots and CNG stations by state", "#state-h"],
  ["04-jobs", "/hub/jobs", "Move a load in minutes", "Post a job and compare haulier quotes", "#open-h"],
  ["05-supply", "/hub/supply", "Regular supply you can rely on", "Every delivery confirmed by both sides", null],
];
const TARGETS = [
  // App Store 6.7" iPhone (1290 x 2796) and Google Play phone (1080 x 1920).
  { name: "ios-6.7", w: 1290, h: 2796, vw: 430, vh: 780, scale: 3 },
  { name: "android-phone", w: 1080, h: 1920, vw: 360, vh: 520, scale: 3 },
];
(async () => {
  const br = await chromium.launch();
  for (const t of TARGETS) {
    const ctx = await br.newContext({ viewport: { width: t.vw, height: t.vh }, deviceScaleFactor: t.scale, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(B + "/login");
    await p.getByLabel("Email").fill(process.env.STORE_SHOT_EMAIL ?? "buyer@refinerylens.test");
    await p.getByLabel("Password").fill(process.env.STORE_SHOT_PASSWORD ?? "RefineryLens-demo-2026");
    await Promise.all([p.waitForURL(/hub|opportunities/), p.getByRole("button", { name: "Sign in" }).click()]);
    fs.mkdirSync(`${out}/${t.name}`, { recursive: true });
    for (const [id, path, title, sub, anchor] of SCREENS) {
      await p.goto(B + path, { waitUntil: "networkidle" });
      if (anchor) await p.evaluate((sel) => { const el = document.querySelector(sel); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70); }, anchor);
      await p.waitForTimeout(300);
      const raw = await p.screenshot({ type: "png" });
      const frame = await br.newPage({ viewport: { width: t.w, height: t.h } });
      const img = `data:image/png;base64,${raw.toString("base64")}`;
      const head = Math.round(t.h * 0.2);
      await frame.setContent(`<html><body style="margin:0;width:${t.w}px;height:${t.h}px;overflow:hidden;background:linear-gradient(160deg,#0b1530 0%,#182a5a 60%,#087c47 140%);font-family:system-ui,-apple-system,sans-serif">
        <div style="height:${Math.round(t.h * 0.006)}px;background:linear-gradient(90deg,#087c47 0 33.3%,#fff 33.3% 66.6%,#087c47 66.6%)"></div>
        <div style="height:${head}px;display:flex;flex-direction:column;justify-content:center;padding:0 ${Math.round(t.w * 0.08)}px;color:#fff">
          <div style="font-weight:700;font-size:${Math.round(t.w * 0.064)}px;line-height:1.12">${title}</div>
          <div style="margin-top:${Math.round(t.w * 0.02)}px;font-size:${Math.round(t.w * 0.036)}px;color:#a3b4e6">${sub}</div>
        </div>
        <div style="display:flex;justify-content:center"><img src="${img}" style="width:${Math.round(t.w * 0.84)}px;border-radius:${Math.round(t.w * 0.05)}px;box-shadow:0 30px 80px rgba(0,0,0,.45);border:${Math.round(t.w * 0.012)}px solid #fff"></div>
      </body></html>`);
      await frame.screenshot({ path: `${out}/${t.name}/${id}.png` });
      await frame.close();
    }
    await ctx.close();
  }
  // Google Play feature graphic, 1024 x 500.
  const fg = await br.newPage({ viewport: { width: 1024, height: 500 } });
  const svg = fs.readFileSync(process.argv[3], "utf8").replace(/<metadata>[\s\S]*?<\/metadata>/, "").replace("<svg", '<svg width="150" height="150"');
  await fg.setContent(`<html><body style="margin:0;width:1024px;height:500px;background:linear-gradient(135deg,#0b1530,#182a5a 65%,#087c47);font-family:system-ui,sans-serif;color:#fff;display:flex;align-items:center;gap:48px;padding:0 80px;box-sizing:border-box">
    ${svg}<div><div style="font-size:64px;font-weight:700">RefineryLens</div><div style="font-size:30px;color:#cbd5f2;margin-top:12px">Nigeria's trade hub for fuel and gas</div></div></body></html>`);
  await fg.screenshot({ path: `${out}/feature-graphic-1024x500.png` });
  await br.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
