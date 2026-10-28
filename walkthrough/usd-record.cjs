/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script run directly with node */
// Records a captioned walkthrough of the US dollar revenue features against a running app on localhost:3000, seeded
// with `npm run db:seed` and then `npx tsx walkthrough/usd-prepare.ts`.
// Usage: node walkthrough/usd-record.cjs <outDir> [durations.json]
// Writes a .webm and timeline.json (when each narration line starts, in ms from the start of the video).
// With durations.json from narrate.py, each line stays on screen until it has been spoken; mix.sh adds the voice.
const fs = require("fs");
const path = require("path");
// PLAYWRIGHT_MODULE lets this use a Playwright install other than the project's (one with a matching browser and ffmpeg).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const BASE = "http://localhost:3000";
const out = process.argv[2];
const lines = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, "usd-narration.json"), "utf8")).map((l) => [l.id, l]));
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

  const nav = () => page.getByRole("navigation", { name: "Administration" });
  // Moving to another page waits for the current line to finish, so the picture never runs ahead of the voice.
  const settle = async () => {
    if (Date.now() < speakingUntil) await wait(speakingUntil - Date.now());
  };
  async function open(name) {
    await settle();
    await nav().getByRole("link", { name }).click();
    await page.waitForLoadState("networkidle");
    await wait(500);
  }
  async function toCard(locator) {
    await locator.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90));
    await wait(500);
  }

  const email = `geneva-${Date.now()}@example.com`;
  const today = new Date().toISOString().slice(0, 10);
  const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

  await step("data page", async () => {
    await go("/data");
    await caption("intro", 2400);
    await caption("gap", 4200);
    await page.locator("#who-h").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 30));
    await caption("buyers", 2800);
    await settle();
    await page.locator("#what-h").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 30));
    await caption("what", 3200);
    await settle();
    await page.locator("#price-h").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 30));
    await caption("pricing", 3600);
  });

  await step("docs", async () => {
    await settle();
    await go("/data/docs");
    await caption("docs", 1600);
    await scroll(500, 5, 320);
  });

  await step("sign up", async () => {
    await settle();
    await go("/register?next=/account/data&for=business");
    await caption("signup", 1200);
    await page.getByLabel("Name").pressSequentially("Lena Keller", { delay: 30 });
    await page.getByLabel("Email").pressSequentially(email, { delay: 20 });
    await page.getByLabel("Password").pressSequentially("geneva-trading-2026", { delay: 20 });
    await page.getByLabel("My business").check();
    await Promise.all([page.waitForURL(/\/(account\/data|hub)/), page.getByRole("button", { name: "Create free account" }).click()]);
    if (!/account\/data/.test(page.url())) await go("/account/data");
    await page.waitForLoadState("networkidle");
  });

  await step("trial", async () => {
    await settle();
    await page.getByLabel("Organisation").pressSequentially("Geneva Trading SA", { delay: 35 });
    await page.getByLabel("Billing country").selectOption("CH");
    await caption("trial", 2400);
    await page.getByRole("button", { name: "Start 14-day free trial" }).click();
    await page.getByRole("heading", { name: /API keys/ }).waitFor();
    await wait(800);
  });

  let key = "";
  await step("key", async () => {
    await settle();
    await page.getByLabel("Key name").pressSequentially("Pricing model", { delay: 35 });
    await caption("key", 1200);
    await page.getByRole("button", { name: "Create API key" }).click();
    key = await page.getByLabel("New API key").inputValue();
    await toCard(page.getByLabel("New API key"));
    await wait(1500);
  });

  await step("call", async () => {
    await settle();
    // A real call with the new key, its response shown as a terminal would show it.
    const res = await page.request.get(`${BASE}/api/v1/latest?item=lpg_cyl_12_5&source=PUBLIC`, { headers: { authorization: `Bearer ${key}` } });
    const body = await res.json();
    const shown = JSON.stringify({ data: body.data.slice(0, 2), meta: body.meta }, null, 2);
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    await page.setContent(`<body style="margin:0;background:#0b1530;color:#e4e9f8;font:15px/1.5 ui-monospace,Menlo,monospace;padding:40px 56px">
      <div style="color:#a3b4e6">$ curl -i -H "Authorization: Bearer ${esc(key.slice(0, 14))}…" \\<br>&nbsp;&nbsp;"https://app.refinerylens.ng/api/v1/latest?item=lpg_cyl_12_5&amp;source=PUBLIC"</div>
      <div style="margin-top:14px;color:#5cd39a">HTTP/1.1 ${res.status()} OK</div>
      <div>X-RateLimit-Limit: ${res.headers()["x-ratelimit-limit"]}<br>X-RateLimit-Remaining: ${res.headers()["x-ratelimit-remaining"]}</div>
      <pre style="margin-top:14px;white-space:pre-wrap">${esc(shown)}</pre></body>`);
    await caption("call", 4200);
  });

  await step("plans", async () => {
    await settle();
    await go("/account/data");
    await page.locator("#plans-h").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 30));
    await caption("plans", 4200);
  });

  await step("sponsor", async () => {
    await settle();
    await context.clearCookies();
    await go("/cng-savings");
    await page.getByRole("complementary", { name: /Sponsored by/ }).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 260));
    await caption("sponsor", 3000);
  });

  await step("admin data", async () => {
    await settle();
    await go("/login");
    await page.getByLabel("Email").fill("admin@refinerylens.test");
    await page.getByLabel("Password").fill("RefineryLens-demo-2026");
    await Promise.all([page.waitForURL(/\/(hub|today|dashboard)/), page.getByRole("button", { name: "Sign in" }).click()]);
    await go("/admin/data");
    await caption("admin", 3200);
    const card = page.locator("li.card").filter({ hasText: "Geneva Trading SA" });
    await toCard(card);
    await caption("enterprise", 1200);
    await card.getByText("Set plan (after an invoice is paid)…").click();
    await card.locator('select[name="plan"]').selectOption("enterprise");
    await wait(600);
    await card.getByRole("button", { name: "Set plan" }).click();
    await card.getByText("Plan set.").waitFor().catch(() => undefined);
    await wait(1500);
  });

  await step("add sponsor", async () => {
    await open(/^Sponsorships/);
    await caption("addsponsor", 1200);
    await page.getByLabel("Sponsor", { exact: true }).pressSequentially("Lagos Cylinder Works (demo)", { delay: 25 });
    await page.getByLabel("Link (https)").pressSequentially("https://example.com/cylinders", { delay: 15 });
    await page.getByLabel("Headline (up to 80)").pressSequentially("Certified 12.5 kg cylinders, delivered", { delay: 20 });
    await page.getByLabel("Text (up to 220)").pressSequentially("New and requalified cylinders for gas shops and refill plants. Demo sponsor.", { delay: 12 });
    await page.locator('input[name="placements"][value="today"]').check();
    await page.locator('input[name="placements"][value="gas-network"]').check();
    await page.locator('input[name="states"][value="Lagos"]').check();
    await page.getByLabel("Price, USD").pressSequentially("1200", { delay: 40 });
    await page.getByLabel("Starts").fill(today);
    await page.getByLabel("Ends").fill(inDays(30));
    await page.getByRole("button", { name: "Add sponsorship" }).click();
    await page.getByText("Lagos Cylinder Works (demo)").first().waitFor();
    await wait(1500);
  });

  await step("payments", async () => {
    await open(/^Payments & plans/);
    await caption("payments", 3200);
  });

  await step("system", async () => {
    await open(/^Health & jobs/);
    await page.getByText("US dollar payments (Stripe, US entity)").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 200));
    await caption("system", 2800);
  });

  await step("end", async () => {
    await settle();
    await go("/data");
    await caption("outro", 3200);
  });

  if (Date.now() < speakingUntil) await wait(speakingUntil - Date.now());
  await wait(800);
  fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(timeline, null, 2));
  await context.close();
  await browser.close();
})();
