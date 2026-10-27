/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script run directly with node */
// Records a captioned walkthrough of the administration console against a running app on localhost:3000, seeded with
// `npm run db:seed` and then `npx tsx walkthrough/admin-prepare.ts`.
// Usage: node walkthrough/admin-record.cjs <outDir> [durations.json]
// Writes a .webm and timeline.json (when each narration line starts, in ms from the start of the video).
// With durations.json from narrate.py, each line stays on screen until it has been spoken; mix.sh adds the voice.
const fs = require("fs");
const path = require("path");
// PLAYWRIGHT_MODULE lets this use a Playwright install other than the project's (one with a matching browser and ffmpeg).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const BASE = "http://localhost:3000";
const out = process.argv[2];
const lines = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, "admin-narration.json"), "utf8")).map((l) => [l.id, l]));
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

  await step("sign in", async () => {
    await go("/login");
    await page.getByLabel("Email").pressSequentially("admin@refinerylens.test", { delay: 30 });
    await page.getByLabel("Password").pressSequentially("RefineryLens-demo-2026", { delay: 20 });
    await Promise.all([page.waitForURL(/\/(hub|today|dashboard)/), page.getByRole("button", { name: "Sign in" }).click()]);
    await go("/admin");
    await caption("intro", 3000);
    await caption("nav", 2600);
  });

  await step("overview", async () => {
    await scroll(420, 4, 320);
    await caption("overview", 3200);
    await scroll(400, 4, 320);
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(400);
    await caption("attention", 2400);
  });

  await step("flags", async () => {
    await settle();
    await page.getByRole("link", { name: /flagged station reports or places/ }).click();
    await page.waitForLoadState("networkidle");
    await wait(600);
    await caption("flags", 3600);
    const card = page.locator("li.card").filter({ hasText: "₦20 above the pump display" });
    await toCard(card);
    await caption("hide", 1200);
    await card.getByRole("button", { name: "Hide" }).click();
    await page.waitForLoadState("networkidle");
    await wait(1500);
  });

  await step("merge", async () => {
    await open(/^Stations & shops/);
    await page.getByPlaceholder("Name, area or brand").pressSequentially("Ojuelegba", { delay: 40 });
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForLoadState("networkidle");
    await caption("merge", 1500);
    const keeper = page.locator("li.card").filter({ hasText: "Ojuelegba Service Station (demo)" });
    const keeperId = (await keeper.locator("p.font-mono").innerText()).replace("ID ", "").trim();
    const dup = page.locator("li.card").filter({ hasText: "MRS Ojuelegba (demo duplicate)" });
    await dup.getByText("Merge into another place…").click();
    await dup.getByLabel("ID of the place to keep (same state)").pressSequentially(keeperId, { delay: 15 });
    await wait(500);
    await dup.getByRole("button", { name: "Merge and hide this one" }).click();
    // Once merged, the page refreshes and the duplicate shows as hidden.
    await page.locator("li.card").filter({ hasText: "MRS Ojuelegba (demo duplicate)" }).getByText("hidden", { exact: true }).waitFor();
    await wait(1800);
  });

  await step("prices", async () => {
    await open(/^Price watch/);
    await caption("prices", 2600);
    const row = page.locator("tr").filter({ hasText: "₦1,500" });
    await toCard(row);
    await wait(1500);
    await row.getByRole("button", { name: "Hide" }).click();
    await page.waitForLoadState("networkidle");
    await wait(1500);
  });

  await step("orders", async () => {
    await open(/^Gas orders/);
    await page.getByRole("link", { name: "Show stuck orders" }).click();
    await page.waitForLoadState("networkidle");
    await caption("orders", 2400);
    const row = page.locator("tr").filter({ hasText: "6 kg" }).first();
    await row.getByText("Cancel").click();
    await row.getByLabel("Reason").pressSequentially("Seller did not answer for 3 hours. Please order again.", { delay: 25 });
    await row.getByRole("button", { name: "Confirm" }).click();
    // The cancelled order leaves the stuck list when the page refreshes.
    await page.locator("tr").filter({ hasText: "Seller did not answer" }).waitFor({ state: "detached" }).catch(() => undefined);
    await row.waitFor({ state: "detached" });
    await wait(1500);
  });

  await step("trips", async () => {
    await open(/^Live trips/);
    await caption("trips", 2400);
    await page.getByRole("button", { name: "End trip" }).first().click();
    await page.waitForLoadState("networkidle");
    await wait(1500);
  });

  await step("verify", async () => {
    await open(/^Verification & reports/);
    await caption("verify", 3000);
    const q = page.locator("li.card").first();
    await q.getByRole("button", { name: "Verify", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await wait(1500);
  });

  await step("users", async () => {
    await open(/^Users/);
    await caption("users", 1600);
    await page.getByPlaceholder("Name, email or phone").pressSequentially("tunde", { delay: 50 });
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForLoadState("networkidle");
    await wait(600);
    await page.getByRole("link", { name: "Tunde Household" }).click();
    await page.waitForLoadState("networkidle");
    await caption("user", 3200);
    await scroll(500, 5, 320);
  });

  await step("businesses", async () => {
    await open(/^Businesses/);
    await page.locator('select[name="delivery"]').selectOption("yes");
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForLoadState("networkidle");
    await caption("businesses", 3200);
  });

  await step("listings and jobs", async () => {
    await open(/^Listings/);
    await caption("listings", 2200);
    await open(/^Delivery jobs/);
    await wait(1800);
  });

  await step("payments", async () => {
    await open(/^Payments & plans/);
    await caption("payments", 3000);
    await scroll(350, 3, 320);
  });

  await step("broadcast", async () => {
    await open(/^Broadcast/);
    await page.locator('select[name="segment"]').selectOption("households");
    await page.locator('select[name="state"]').selectOption("Lagos");
    await page.getByRole("button", { name: "Count" }).click();
    await page.waitForLoadState("networkidle");
    await caption("broadcast", 1500);
    await page.getByLabel("Title (up to 80 characters)").pressSequentially("Cooking gas is cheaper this week", { delay: 30 });
    await page.getByLabel("Message (up to 400 characters)").pressSequentially("12.5 kg refills in Lagos fell by about 3%. Check today's prices before you buy.", { delay: 20 });
    await page.getByRole("button", { name: /^Send to/ }).click();
    await page.getByText(/^Sent to \d+/).waitFor();
    await wait(1800);
  });

  await step("system", async () => {
    await open(/^Health & jobs/);
    await caption("system", 2400);
    await page.getByRole("button", { name: "Retry all" }).click();
    await page.waitForLoadState("networkidle");
    await scroll(400, 4, 320);
  });

  await step("audit", async () => {
    await open(/^Audit log/);
    await page.getByPlaceholder("e.g. admin. or user.login").pressSequentially("admin.", { delay: 60 });
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForLoadState("networkidle");
    await caption("audit", 3200);
  });

  await step("exports", async () => {
    await open(/^Exports/);
    await caption("exports", 2600);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.locator('a[href="/api/admin/exports/gas-orders"]').click()]);
    await dl.saveAs(`${out}/gas-orders.csv`);
    await wait(1200);
  });

  await step("end", async () => {
    await open(/^Overview/);
    await caption("outro", 3500);
  });

  if (Date.now() < speakingUntil) await wait(speakingUntil - Date.now());
  await wait(800);
  fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(timeline, null, 2));
  await context.close();
  await browser.close();
})();
