/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script run directly with node */
// Records a captioned walkthrough of RefineryLens against a running, seeded app on localhost:3000.
// Usage: node walkthrough/record.cjs <outDir> [durations.json]
// Writes a .webm and timeline.json (when each narration line starts, in ms from the start of the video).
// With durations.json from narrate.py, each line stays on screen until it has been spoken; mix.sh adds the voice.
// Start the app with a geocoder configured (GEOCODER, NOMINATIM_EMAIL, NOMINATIM_URL) so the live map can place the
// drop-off and show distance and arrival time.
const fs = require("fs");
const path = require("path");
// PLAYWRIGHT_MODULE lets this use a Playwright install other than the project's (one with a matching browser and ffmpeg).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const BASE = "http://localhost:3000";
const out = process.argv[2];
const lines = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, "narration.json"), "utf8")).map((l) => [l.id, l]));
const durations = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")) : {};

(async () => {
  const browser = await chromium.launch();
  // Location permission is granted up front so the driver page can share a (simulated) position.
  const context = await browser.newContext({
    geolocation: { latitude: 6.585, longitude: 3.353 },
    permissions: ["geolocation"],
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: out, size: { width: 1280, height: 720 } },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const videoStart = Date.now();
  const timeline = [];
  let speakingUntil = 0;
  page.setDefaultTimeout(15000);
  const wait = (ms) => page.waitForTimeout(ms);

  // Shows a line's caption and holds for `ms`; the following steps run while it is spoken.
  async function caption(id, ms = 2600) {
    const text = lines[id].caption;
    if (Date.now() < speakingUntil) await wait(speakingUntil - Date.now());
    timeline.push({ id, at: Date.now() - videoStart });
    speakingUntil = Date.now() + (durations[id] ?? 0) + 500;
    await page.evaluate((t) => {
      let el = document.getElementById("__wt_caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "__wt_caption";
        el.style.cssText =
          "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;max-width:1000px;" +
          "background:rgba(15,23,42,.92);color:#fff;font:600 20px/1.35 system-ui,sans-serif;padding:12px 22px;" +
          "border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35);text-align:center;pointer-events:none";
        document.body.appendChild(el);
      }
      el.textContent = t;
    }, text);
    await wait(ms);
  }
  async function scroll(px, steps = 6, pause = 260) {
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, px / steps);
      await wait(pause);
    }
  }
  async function go(path) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await wait(500);
  }
  async function signIn(email) {
    await context.clearCookies();
    await go("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("RefineryLens-demo-2026");
    await Promise.all([page.waitForURL(/\/(hub|today)/), page.getByRole("button", { name: "Sign in" }).click()]);
  }
  async function step(name, fn) {
    try {
      await fn();
    } catch (e) {
      console.error(`step "${name}" failed: ${e.message.split("\n")[0]}`);
    }
  }

  let orderPath = "";
  let driverLink = "";

  await step("landing", async () => {
    await go("/");
    await caption("intro", 3500);
    await page.locator("#everyday-h").scrollIntoViewIfNeeded();
    await wait(400);
    await caption("everydayband", 1800);
  });

  await step("today", async () => {
    await go("/today?state=Lagos");
    await caption("today", 2600);
    await scroll(450, 5, 320);
    await caption("median", 3000);
    await scroll(300, 3, 320);
  });

  await step("stations", async () => {
    await go("/stations?state=Lagos");
    await caption("stations", 2600);
    await scroll(500, 5, 320);
    await page.getByRole("link", { name: /Ikorodu Road Filling Station/ }).click();
    await page.waitForLoadState("networkidle");
    await wait(600);
    await page.getByRole("heading", { name: "Problems reported in the last 30 days" }).scrollIntoViewIfNeeded();
    await caption("problems", 3000);
  });

  await step("login", async () => {
    await context.clearCookies();
    await go("/login");
    await caption("login", 1500);
    await page.getByLabel("Email").pressSequentially("tunde@refinerylens.test", { delay: 35 });
    await page.getByLabel("Password").pressSequentially("RefineryLens-demo-2026", { delay: 25 });
    await Promise.all([page.waitForURL(/\/today/), page.getByRole("button", { name: "Sign in" }).click()]);
    await page.waitForLoadState("networkidle");
    await scroll(250, 2, 300);
    await caption("reminder", 2600);
  });

  await step("my gas", async () => {
    await go("/my-gas");
    await caption("mygas", 2400);
    await scroll(350, 4, 320);
  });

  await step("order", async () => {
    await go("/order?state=Lagos");
    await caption("order", 2400);
    await scroll(250, 3, 300);
    await page.getByLabel(/Surulere Gas Point/).check();
    await wait(400);
    await page.getByLabel("Area *").pressSequentially("Surulere", { delay: 40 });
    await page.getByLabel("Delivery address and landmark *").pressSequentially("14 Demo Close, off Bode Thomas St", { delay: 30 });
    await page.getByRole("button", { name: /Place order/ }).scrollIntoViewIfNeeded();
    await wait(800);
    await Promise.all([page.waitForURL(/\/orders\/[a-z0-9]+/), page.getByRole("button", { name: /Place order/ }).click()]);
    await page.waitForLoadState("networkidle");
    orderPath = new URL(page.url()).pathname;
    await caption("placed", 1800);
  });

  await step("seller accepts", async () => {
    await signIn("surulere@refinerylens.test");
    await go("/hub/orders");
    const card = page.locator("li.card").filter({ has: page.locator(`a[href="${orderPath}"]`) });
    await card.scrollIntoViewIfNeeded();
    await caption("seller", 2600);
    await card.getByRole("button", { name: "Accept" }).click();
    await card.getByText(/agreed/).waitFor();
    await wait(800);
    await caption("driverlink", 1200);
    await card.getByText(/Track the driver live/).click();
    await card.getByLabel("Driver's name").pressSequentially("Musa", { delay: 50 });
    await card.getByLabel(/Driver's phone/).pressSequentially("08030001111", { delay: 30 });
    await card.getByRole("button", { name: "Create driver link" }).click();
    driverLink = await card.getByLabel("Driver link").inputValue();
    await card.getByRole("link", { name: /Send by WhatsApp/ }).scrollIntoViewIfNeeded();
    await wait(1800);
  });

  // The rider's phone: positions from Ikeja towards Surulere, sent every 10 seconds as the driver page would.
  const route = Array.from({ length: 14 }, (_, i) => ({ lat: 6.585 - i * 0.0062, lon: 3.353 + Math.sin(i / 2) * 0.004 }));
  let leg = 0;
  let pinger = null;
  const sendNext = async () => {
    const p = route[Math.min(leg++, route.length - 1)];
    await page.request.post(`${driverLink}`.replace("/drive/", "/api/drive/") + "/ping", { data: { lat: p.lat, lon: p.lon, accuracy: 10, speed: 7, heading: 180 } }).catch(() => undefined);
  };

  await step("driver", async () => {
    await page.goto(driverLink, { waitUntil: "networkidle" });
    await caption("driver", 2600);
    await page.getByRole("button", { name: "Start sharing my location" }).click();
    await page.getByText("Sharing your location").waitFor();
    await wait(2500);
    leg = 1;
    pinger = setInterval(sendNext, 10_500);
  });

  await step("follow", async () => {
    await signIn("tunde@refinerylens.test");
    await go(orderPath);
    await page.getByRole("heading", { name: "Live tracking" }).waitFor();
    await caption("follow", 4000);
    await page.locator("#track-h").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 80));
    await wait(22_000);
    clearInterval(pinger);
  });

  await step("cng", async () => {
    await go("/cng-savings");
    await caption("cng", 1500);
    await page.getByLabel("Conversion quote, ₦ (optional)").pressSequentially("650000", { delay: 60 });
    await wait(600);
    await scroll(400, 4, 320);
  });

  await step("business", async () => {
    await go("/hub");
    await caption("business", 2200);
    await go("/hub/prices?item=lpg_retail_kg");
    await page.locator("#board-h").scrollIntoViewIfNeeded();
    await caption("board", 2600);
    await go("/hub/gas?state=Kano");
    await caption("gasmap", 2600);
    await scroll(600, 6, 320);
    await go("/hub/jobs");
    await caption("jobs", 2600);
    await scroll(400, 4, 320);
    await go("/opportunities");
    await caption("opps", 2600);
    await scroll(600, 6, 320);
  });

  await step("end", async () => {
    await go("/today");
    await caption("outro", 3500);
  });

  if (Date.now() < speakingUntil) await wait(speakingUntil - Date.now());
  await wait(800);
  fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(timeline, null, 2));
  await context.close();
  await browser.close();
})();
