/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script run directly with node */
// Records a captioned walkthrough of RefineryLens for Nigerians everywhere (the brand, send gas home, paying online,
// commission, Plus and payouts) against a running app on localhost:3000, seeded with `npm run db:seed` and then
// `npx tsx walkthrough/money-prepare.ts`. Start the app with PAYMENT_PROVIDER=paystack and placeholder PAYSTACK_SECRET_KEY
// and STRIPE_SECRET_KEY so the pay buttons show; the card payment itself is stood in for by walkthrough/money-pay.ts.
// Usage: node walkthrough/money-record.cjs <outDir> [durations.json]
// Writes a .webm and timeline.json (when each narration line starts, in ms from the start of the video).
// With durations.json from narrate.py, each line stays on screen until it has been spoken; mix.sh adds the voice.
const fs = require("fs");
const { execFileSync } = require("child_process");
const path = require("path");
// PLAYWRIGHT_MODULE lets this use a Playwright install other than the project's (one with a matching browser and ffmpeg).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const BASE = "http://localhost:3000";
const out = process.argv[2];
const lines = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, "money-narration.json"), "utf8")).map((l) => [l.id, l]));
const durations = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")) : {};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
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
  async function step(name, fn) {
    try {
      await fn();
    } catch (e) {
      console.error(`step "${name}" failed: ${e.message.split("\n")[0]}`);
    }
  }

  // Moving to another page waits for the current line to finish, so the picture never runs ahead of the voice.
  const settle = async () => {
    if (Date.now() < speakingUntil) await wait(speakingUntil - Date.now());
  };
  async function toCard(locator) {
    await locator.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90));
    await wait(500);
  }

  async function signIn(email) {
    await settle();
    await context.clearCookies();
    await go("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("RefineryLens-demo-2026");
    await Promise.all([page.waitForURL(/\/(hub|today)/), page.getByRole("button", { name: "Sign in" }).click()]);
    await page.waitForLoadState("networkidle");
  }
  const to = (sel) => page.locator(sel).first().evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 40, behavior: "smooth" }));

  await step("landing", async () => {
    await go("/");
    await caption("intro", 3000);
    await caption("hero", 3000);
    await settle();
    await to("#everyday-h");
    await caption("home", 3000);
    await settle();
    await to("#home-h");
    await caption("abroad", 3000);
    await settle();
    await to("#pricing-h");
    await caption("pricing", 3000);
  });

  let orderPath = "";
  await step("order", async () => {
    await signIn("chidi@refinerylens.test");
    await caption("chidi", 1500);
    await settle();
    await go("/order?for=family&state=Lagos");
    await caption("order", 900);
    await page.getByLabel(/Ikeja Energy Supplies/).check();
    await wait(500);
    await page.getByLabel("Who is receiving it? *").pressSequentially("Mama Ngozi", { delay: 45 });
    await page.getByLabel("Area *").pressSequentially("Surulere", { delay: 40 });
    await page.getByLabel(/Their phone, for the rider/).pressSequentially("0803 123 4567", { delay: 40 });
    await page.getByLabel("Delivery address and landmark *").pressSequentially("14 Bode Thomas Street, opposite the pharmacy", { delay: 25 });
    await page.getByRole("button", { name: "Place order for them" }).scrollIntoViewIfNeeded();
    await wait(1200);
    await settle();
    await Promise.all([page.waitForURL(/\/orders\/[a-z0-9]+\?placed=1/), page.getByRole("button", { name: "Place order for them" }).click()]);
    orderPath = new URL(page.url()).pathname;
    await wait(400);
    await caption("placed", 2000);
  });

  await step("accept", async () => {
    await signIn("seller@refinerylens.test");
    await go("/hub/orders");
    const card = page.locator("li.card").filter({ has: page.locator(`a[href="${orderPath}"]`) });
    await toCard(card);
    await caption("accept", 1800);
    await card.getByRole("button", { name: "Accept" }).click();
    await card.getByText(/agreed/).waitFor();
    await wait(1400);
  });

  await step("pay", async () => {
    await signIn("chidi@refinerylens.test");
    await go(orderPath);
    await toCard(page.getByRole("heading", { name: "Pay online now" }));
    await caption("pay", 3800);
    await settle();
    execFileSync("npx", ["tsx", path.join(__dirname, "money-pay.ts"), orderPath.split("/").pop()], { stdio: "inherit" });
    await go(`${orderPath}?payment=success`);
    await caption("paid", 3000);
  });

  await step("seller", async () => {
    await signIn("seller@refinerylens.test");
    await go("/hub/orders");
    const card = page.locator("li.card").filter({ has: page.locator(`a[href="${orderPath}"]`) });
    await toCard(card);
    await caption("seller", 2600);
    await settle();
    await card.getByRole("button", { name: "Delivered" }).click();
    await page.waitForLoadState("networkidle");
    await wait(1200);
    await to("#money-h");
    await caption("deliver", 2600);
    await caption("ledger", 3000);
  });

  await step("plus", async () => {
    await signIn("chidi@refinerylens.test");
    await go("/settings");
    await to("#plans-h");
    await caption("plus", 3000);
  });

  await step("admin", async () => {
    await signIn("admin@refinerylens.test");
    await go("/admin/payments");
    await caption("admin", 3200);
    await settle();
    await to("#po-h");
    await caption("payout", 1800);
    await page.getByRole("button", { name: "Mark paid out" }).first().click();
    await page.waitForLoadState("networkidle");
    await wait(1500);
  });

  await step("end", async () => {
    await settle();
    await context.clearCookies();
    await go("/");
    await caption("outro", 3200);
  });

  if (Date.now() < speakingUntil) await wait(speakingUntil - Date.now());
  await wait(800);
  fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(timeline, null, 2));
  await context.close();
  await browser.close();
})();
