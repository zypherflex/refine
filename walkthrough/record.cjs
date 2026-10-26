// Records a captioned walkthrough of RefineryLens against a running, seeded app on localhost:3000.
// Usage: node walkthrough/record.cjs <outDir>  (writes a .webm; convert with ffmpeg -i in.webm -c:v libx264 -pix_fmt yuv420p out.mp4)
const { chromium } = require("playwright");
const BASE = "http://localhost:3000";
const out = process.argv[2];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: out, size: { width: 1280, height: 720 } },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const wait = (ms) => page.waitForTimeout(ms);

  async function caption(text, ms = 2600) {
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

  await step("landing", async () => {
    await go("/");
    await caption("RefineryLens: independent business intelligence on opportunities around Dangote", 3500);
    await scroll(900, 8, 350);
    await caption("Every figure carries its source, period and provenance label", 2800);
  });

  await step("login", async () => {
    await go("/login");
    await caption("Sign in with a demo account (investor, Pro plan)", 1800);
    await page.getByLabel("Email").pressSequentially("investor@refinerylens.test", { delay: 35 });
    await page.getByLabel("Password").pressSequentially("RefineryLens-demo-2026", { delay: 25 });
    await Promise.all([page.waitForURL(/\/opportunities/), page.getByRole("button", { name: "Sign in" }).click()]);
    await page.waitForLoadState("networkidle");
  });

  await step("hub", async () => {
    await caption("The business opportunities hub: 14 ways to plug into the Lekki complex", 3200);
    await scroll(1200, 10, 300);
    await caption("Filter by business size, from micro to enterprise", 1800);
    await go("/opportunities");
    await page.getByRole("link", { name: /^Micro/ }).click();
    await page.waitForLoadState("networkidle");
    await wait(800);
    await scroll(700, 6, 300);
    await caption("Only opportunities a micro business can realistically pursue remain", 2600);
  });

  await step("fit", async () => {
    await go("/opportunities/fit");
    await caption("Find my fit: describe your business, get ranked matches", 2600);
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
    await caption("Each match explains why it is listed, including assets you already have", 3400);
    await scroll(600, 6, 350);
  });

  await step("opportunity", async () => {
    await go("/opportunities/lpg-retail");
    await caption("An opportunity page: LPG cylinder refilling and retail", 2600);
    await scroll(700, 7, 350);
    await caption("Company-stated facts, dated independent reports, questions and licences to check", 3200);
    await scroll(700, 7, 350);
    const tick = page.getByRole("button", { name: /^Tick: / }).first();
    await tick.scrollIntoViewIfNeeded();
    await caption("Readiness checklist: tick off what you have already answered", 2200);
    await tick.click();
    await wait(1400);
    const fill = page.getByRole("button", { name: "Fill blanks with example numbers" });
    await fill.scrollIntoViewIfNeeded();
    await caption("The sizing tool: enter your own numbers, or start from labelled examples", 2600);
    await fill.click();
    await wait(1200);
    await scroll(500, 5, 350);
    await caption("Formulas stay visible, so every result can be checked", 2600);
    await page.getByTestId("sensitivity").scrollIntoViewIfNeeded();
    await caption("What-if table: each key input moved ±10% to show what matters most", 3400);
    const save = page.getByLabel("Save as a private scenario");
    await save.scrollIntoViewIfNeeded();
    await save.pressSequentially("Lekki LPG kiosk", { delay: 40 });
    await page.getByRole("button", { name: "Save scenario" }).click();
    await wait(1200);
    await caption("Save a private scenario and track the opportunity on your board", 2200);
    await page.getByLabel("Stage").selectOption("VALIDATING");
    await page.getByLabel("Next step").pressSequentially("Ask two bulk suppliers for quotes", { delay: 30 });
    await page.getByRole("button", { name: /Add to my board|Update board/ }).click();
    await wait(1500);
    const brief = page.getByRole("button", { name: "Download brief (PDF)" });
    await brief.scrollIntoViewIfNeeded();
    await caption("Download a one-page PDF brief with sources, readiness answers and the scenario", 2400);
    const [dl] = await Promise.all([page.waitForEvent("download"), brief.click()]);
    await dl.saveAs(`${out}/brief.pdf`);
    await wait(1200);
  });

  await step("board", async () => {
    await go("/opportunities/board");
    await caption("My opportunity board: stage, next step, readiness progress and saved scenarios", 3400);
    await scroll(500, 5, 350);
  });

  await step("dashboard", async () => {
    await go("/dashboard");
    const sw = page.locator("#company-switch");
    if (await sw.count()) {
      await Promise.all([page.waitForLoadState("networkidle"), sw.selectOption("demo-lagoon-coast")]).catch(() => {});
      await wait(800);
    }
    await caption("Behind it: the evidence-first research layer (shown here on a fictional demo company)", 3400);
    await scroll(900, 8, 350);
    await caption("Sourced metrics, what changed, conflicts kept visible", 2600);
  });

  await step("assistant", async () => {
    await go("/assistant");
    await caption("The research assistant answers only from cited evidence", 2400);
    await page.getByLabel("Your question").pressSequentially("Why did operating cash flow lag net profit in H1 2026?", { delay: 25 });
    await page.getByRole("button", { name: "Ask" }).click();
    await page.getByRole("heading", { name: "Direct answer" }).waitFor({ timeout: 20000 });
    await wait(800);
    await caption("A direct answer, with every claim linked to its source", 3000);
    await scroll(700, 7, 350);
  });

  await step("market", async () => {
    await go("/market");
    await caption("Market and macro context, labelled as non-company data, with honest gaps", 3200);
    await scroll(600, 6, 350);
  });

  await step("end", async () => {
    await go("/opportunities");
    await caption("RefineryLens: find the opportunity, examine the evidence, size it with your own numbers", 4000);
  });

  await context.close();
  await browser.close();
})();
