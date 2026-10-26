// Records a captioned walkthrough of RefineryLens against a running, seeded app on localhost:3000.
// Usage: node walkthrough/record.cjs <outDir> [durations.json]
// Writes a .webm and timeline.json (when each narration line starts, in ms from the start of the video).
// With durations.json from narrate.py, each line stays on screen until it has been spoken; mix.sh adds the voice.
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
  async function signIn(email) {
    await context.clearCookies();
    await go("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("RefineryLens-demo-2026");
    await Promise.all([page.waitForURL(/\/opportunities/), page.getByRole("button", { name: "Sign in" }).click()]);
  }
  async function step(name, fn) {
    try {
      await fn();
    } catch (e) {
      console.error(`step "${name}" failed: ${e.message.split("\n")[0]}`);
    }
  }

  await step("landing", async () => {
    await go("/");
    await caption("intro", 3500);
    await scroll(900, 8, 350);
    await caption("sourced", 2800);
  });

  await step("login", async () => {
    await go("/login");
    await caption("login", 1800);
    await page.getByLabel("Email").pressSequentially("investor@refinerylens.test", { delay: 35 });
    await page.getByLabel("Password").pressSequentially("RefineryLens-demo-2026", { delay: 25 });
    await Promise.all([page.waitForURL(/\/opportunities/), page.getByRole("button", { name: "Sign in" }).click()]);
    await page.waitForLoadState("networkidle");
  });

  await step("hub", async () => {
    await caption("hub", 3200);
    await scroll(1200, 10, 300);
    await caption("filter", 1800);
    await go("/opportunities");
    await page.getByRole("link", { name: /^Micro/ }).click();
    await page.waitForLoadState("networkidle");
    await wait(800);
    await scroll(700, 6, 300);
    await caption("micro", 2600);
  });

  await step("fit", async () => {
    await go("/opportunities/fit");
    await caption("fit", 2600);
    await page.getByLabel(/^Micro/).check();
    await wait(500);
    await page.getByLabel("LPG and CNG").check();
    await wait(500);
    await page.getByLabel("Tanker trucks or a delivery fleet").check();
    await wait(600);
    await page.getByRole("button", { name: "Show my matches" }).click();
    await page.waitForURL(/fit=1/);
    await page.waitForLoadState("networkidle");
    await page.locator("#for-you").scrollIntoViewIfNeeded();
    await caption("matches", 3400);
    await scroll(600, 6, 350);
  });

  await step("opportunity", async () => {
    await go("/opportunities/lpg-retail");
    await caption("opp", 2600);
    await scroll(700, 7, 350);
    await caption("evidence", 3200);
    await scroll(700, 7, 350);
    const tick = page.getByRole("button", { name: /^Tick: / }).first();
    await tick.scrollIntoViewIfNeeded();
    await caption("ready", 2200);
    await tick.click();
    await wait(1400);
    const fill = page.getByRole("button", { name: "Fill blanks with example numbers" });
    await fill.scrollIntoViewIfNeeded();
    await caption("sizing", 2600);
    await fill.click();
    await wait(1200);
    await scroll(500, 5, 350);
    await caption("formulas", 2600);
    await page.getByTestId("sensitivity").scrollIntoViewIfNeeded();
    await caption("whatif", 3400);
    const save = page.getByLabel("Save as a private scenario");
    await save.scrollIntoViewIfNeeded();
    await caption("board", 800);
    await save.pressSequentially("Lekki LPG kiosk", { delay: 40 });
    await page.getByRole("button", { name: "Save scenario" }).click();
    await wait(1200);
    await page.getByLabel("Stage").selectOption("VALIDATING");
    await page.getByLabel("Next step").pressSequentially("Ask two bulk suppliers for quotes", { delay: 30 });
    await page.getByRole("button", { name: /Add to my board|Update board/ }).click();
    await wait(1500);
    const brief = page.getByRole("button", { name: "Download brief (PDF)" });
    await brief.scrollIntoViewIfNeeded();
    await caption("brief", 2400);
    const [dl] = await Promise.all([page.waitForEvent("download"), brief.click()]);
    await dl.saveAs(`${out}/brief.pdf`);
    await wait(1200);
  });

  await step("board", async () => {
    await go("/opportunities/board");
    await caption("boardpage", 3400);
    await scroll(500, 5, 350);
  });

  await step("dashboard", async () => {
    await go("/dashboard");
    const sw = page.locator("#company-switch");
    if (await sw.count()) {
      await Promise.all([page.waitForLoadState("networkidle"), sw.selectOption("demo-lagoon-coast")]).catch(() => {});
      await wait(800);
    }
    await caption("research", 3400);
    await scroll(900, 8, 350);
    await caption("metrics", 2600);
  });

  await step("assistant", async () => {
    await go("/assistant");
    await caption("assistant", 2400);
    await page.getByLabel("Your question").pressSequentially("Why did operating cash flow lag net profit in H1 2026?", { delay: 25 });
    await page.getByRole("button", { name: "Ask" }).click();
    await page.getByRole("heading", { name: "Direct answer" }).waitFor({ timeout: 20000 });
    await wait(800);
    await caption("answer", 3000);
    await scroll(700, 7, 350);
  });

  await step("market", async () => {
    await go("/market");
    await caption("market", 3200);
    await scroll(600, 6, 350);
  });

  await step("trade hub", async () => {
    await caption("tradeintro", 1500);
    await signIn("converter@refinerylens.test");
    await go("/hub");
    await caption("trade", 3000);
    await scroll(900, 8, 350);
    await page.getByLabel("Product").selectOption("pp");
    await caption("tradefilter", 1200);
    await Promise.all([page.waitForURL(/product=pp/), page.getByRole("button", { name: "Show" }).click()]);
    await page.waitForLoadState("networkidle");
    await wait(1200);
  });

  await step("trade listing", async () => {
    await page.getByRole("link", { name: "Polypropylene resin, injection and raffia grades" }).click();
    await page.waitForLoadState("networkidle");
    await caption("tradelisting", 3000);
    await scroll(500, 5, 350);
    const box = page.getByLabel("Your message");
    await box.scrollIntoViewIfNeeded();
    await caption("tradeenquire", 800);
    await box.pressSequentially("We need 40 tonnes of raffia grade a month in Sagamu. Can you quote delivered?", { delay: 30 });
    await Promise.all([page.waitForURL(/\/hub\/inbox\/.+/), page.getByRole("button", { name: "Send message" }).click()]);
    await page.waitForLoadState("networkidle");
    await wait(1500);
  });

  await step("trade refineries", async () => {
    await go("/hub/refineries");
    await caption("traderefineries", 3000);
    await scroll(400, 4, 350);
  });

  await step("trade reply", async () => {
    await signIn("refinery@refinerylens.test");
    await go("/hub/inbox");
    await caption("tradereply", 2000);
    await page.locator("main").getByRole("link", { name: /Ogun Resin Converters/ }).click();
    await page.waitForLoadState("networkidle");
    await wait(800);
    await page.getByLabel("Reply").pressSequentially("Yes, 40 tonnes monthly works. Quote by Friday.", { delay: 30 });
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByText("Quote by Friday").waitFor();
    await wait(1500);
  });

  await step("trade verify", async () => {
    await signIn("admin@refinerylens.test");
    await go("/admin/hub");
    await caption("tradeverify", 2500);
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await page.getByRole("heading", { name: "Verification requests (0)" }).waitFor();
    await wait(1500);
  });

  await step("end", async () => {
    await go("/hub");
    await caption("outro", 4000);
  });

  if (Date.now() < speakingUntil) await wait(speakingUntil - Date.now());
  await wait(800);
  fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(timeline, null, 2));
  await context.close();
  await browser.close();
})();
