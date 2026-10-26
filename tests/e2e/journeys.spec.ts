import { test, expect, type Page, type Cookie } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const PASSWORD = "RefineryLens-demo-2026";
// Sign in through the form once per user, then reuse the session: the app rate-limits repeated sign-ins.
const sessions = new Map<string, Cookie[]>();

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  const saved = sessions.get(email);
  if (saved) {
    await page.context().addCookies(saved);
    await page.goto("/dashboard");
    return;
  }
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await Promise.all([page.waitForURL(/\/opportunities/), page.getByRole("button", { name: "Sign in" }).click()]);
  sessions.set(email, (await page.context().cookies()).filter((c) => c.name === "rl_session"));
}

async function selectCompany(page: Page, slug: string) {
  await Promise.all([page.waitForLoadState("networkidle"), page.locator("#company-switch").selectOption(slug)]);
  await expect(page.locator("#company-switch")).toHaveValue(slug);
}

test("landing page presents RefineryLens as independent @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Business opportunities around Dangote");
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/dangote (petroleum )?refinery/i);
  await expect(page.getByText(/not affiliated with, endorsed by or sponsored by/).first()).toBeVisible();
  await expect(page.locator("img[src*='dangote' i]")).toHaveCount(0);
});

test("investor reads the demo dashboard, with the fiction banner and sourced metrics @mobile", async ({ page }) => {
  await signIn(page, "investor@refinerylens.test");
  await selectCompany(page, "demo-lagoon-coast");
  await page.goto("/dashboard");
  await expect(page.getByText("Fictional demonstration company").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "What changed?" })).toBeVisible();
  await expect(page.getByText("Source, page").first()).toBeVisible();
  // No horizontal scrolling at any viewport.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("Dangote coverage shows honest unavailable states and no unverified market data", async ({ page }) => {
  await signIn(page, "investor@refinerylens.test");
  await selectCompany(page, "dangote");
  await page.goto("/dashboard");
  await expect(page.getByText("Independent research. RefineryLens is not affiliated with")).toBeVisible();
  await expect(page.getByText("No reviewed announcements yet")).toBeVisible();
  const body = (await page.locator("main").innerText()).toLowerCase();
  expect(body).not.toMatch(/share price|ticker/);
  await page.goto("/financials");
  await expect(page.getByText(/not publicly disclosed|no published figure/i).first()).toBeVisible();
});

test("readers cannot reach the editorial desk; editors see the review queue", async ({ page }) => {
  await signIn(page, "investor@refinerylens.test");
  await page.goto("/editorial");
  await expect(page).toHaveURL(/denied/);
  await signIn(page, "editor@refinerylens.test");
  await page.goto("/editorial");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/IPO|offer/i).first()).toBeVisible();
});

test("research assistant answers with citations", async ({ page }) => {
  await signIn(page, "investor@refinerylens.test");
  await selectCompany(page, "demo-lagoon-coast");
  await page.goto("/assistant");
  await page.getByLabel("Your question").fill("Why did operating cash flow lag net profit in H1 2026?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByRole("heading", { name: "Direct answer" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await expect(page.getByText(/not investment advice/i).first()).toBeVisible();
});

test("a new thesis is saved privately as version 1", async ({ page }) => {
  await signIn(page, "investor@refinerylens.test");
  await page.goto("/thesis/new");
  const title = `E2E thesis ${Date.now()}`;
  await page.getByLabel("Thesis title").fill(title);
  await page.getByLabel("Investment rationale").fill("Exports should diversify revenue away from regulated domestic pricing.");
  if (!(await page.locator("#as-0").count())) await page.getByRole("button", { name: "Add assumption" }).click();
  await page.locator("#as-0").fill("Export volumes keep rising.");
  await page.getByRole("button", { name: "Save thesis" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText(/version 1/i).first()).toBeVisible();
});

test("another user's private file is not downloadable over HTTP", async ({ page, request }) => {
  const db = new PrismaClient();
  const obiDoc = await db.document.findFirstOrThrow({ where: { visibility: "PRIVATE", owner: { email: "other@refinerylens.test" } } });
  await db.$disconnect();
  // Anonymous
  const anon = await request.get(`/api/documents/${obiDoc.id}/download`, { maxRedirects: 0 });
  expect([401, 403, 404, 307]).toContain(anon.status());
  // Signed in as a different investor
  await signIn(page, "investor@refinerylens.test");
  const res = await page.request.get(`/api/documents/${obiDoc.id}/download`, { maxRedirects: 0 });
  expect([403, 404]).toContain(res.status());
  await page.goto(`/documents/${obiDoc.id}`);
  await expect(page.getByText("Obi's private model")).toHaveCount(0);
  // The owner can download it.
  await signIn(page, "other@refinerylens.test");
  const own = await page.request.get(`/api/documents/${obiDoc.id}/download`);
  expect(own.status()).toBe(200);
});

test("editor publishes a sourced announcement, corrects it, and readers see both", async ({ page }) => {
  const db = new PrismaClient();
  const draft = await db.announcement.findFirstOrThrow({ where: { status: "IN_REVIEW", headline: { startsWith: "Q3 2026 trading update" } } });
  const thesis = await db.thesis.findFirstOrThrow({ where: { owner: { email: "investor@refinerylens.test" }, title: { startsWith: "Utilization-led" } } });
  await db.$disconnect();

  await signIn(page, "editor@refinerylens.test");
  await page.goto(`/editorial/announcements/${draft.id}`);
  await page.getByRole("button", { name: /Approve after checking sources/ }).click();
  await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByLabel("Correction note (shown publicly) *")).toBeVisible();

  const note = `Corrected the nine-month period label in browser test ${Date.now()}.`;
  const summary = page.locator("#c-summary");
  await summary.fill((await summary.inputValue()) + " Figures cover January to September.");
  await page.getByLabel("Correction note (shown publicly) *").fill(note);
  await page.getByRole("button", { name: "Publish correction" }).click();
  await expect(page.getByText("Correction published and logged")).toBeVisible();

  await signIn(page, "investor@refinerylens.test");
  await page.goto(`/announcements/${draft.id}`);
  await expect(page.getByText("Reviewed and published").first()).toBeVisible();
  await expect(page.getByText(note)).toBeVisible();
  await page.goto("/corrections");
  await expect(page.getByText(note)).toBeVisible();
  await page.goto(`/thesis/${thesis.id}`);
  await expect(page.getByText(draft.headline).first()).toBeVisible();
});

test("market context is labelled as non-company data and shows honest gaps @mobile", async ({ page }) => {
  await signIn(page, "investor@refinerylens.test");
  await page.goto("/market");
  await expect(page.getByRole("heading", { level: 1, name: "Market & macro context" })).toBeVisible();
  await expect(page.getByText("Context, not company data")).toBeVisible();
  await expect(page.getByText(/Not available yet|Feed not connected/).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.goto("/refineries");
  await expect(page.getByRole("heading", { level: 1, name: "Global refinery directory" })).toBeVisible();
  await expect(page.getByText("Modelled inventory, not company disclosures")).toBeVisible();
});

test("readers see an open-data series only once its source is approved, with attribution", async ({ page }) => {
  const db = new PrismaClient();
  const source = await db.source.create({ data: { name: `E2E open data ${Date.now()}`, publisher: "E2E test publisher", provenance: "REGULATOR_EXCHANGE", approved: false } });
  const series = await db.marketSeries.create({
    data: {
      key: "wb.ng_inflation", provider: "worldbank", externalId: "NGA:FP.CPI.TOTL.ZG", label: "Consumer price inflation", description: "e2e", unit: "% a year", frequency: "ANNUAL", contextScope: "NIGERIA_MACRO", geography: "Nigeria", sourceId: source.id, attribution: "The World Bank: World Development Indicators (CC BY 4.0)", lastRetrievedAt: new Date(),
      observations: { create: [{ period: "2024", periodStart: new Date("2024-01-01"), periodEnd: new Date("2024-12-31"), value: 11.11, retrievedAt: new Date() }, { period: "2025", periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"), value: 22.22, retrievedAt: new Date() }] },
    },
  });
  try {
    await signIn(page, "investor@refinerylens.test");
    await page.goto("/market");
    await expect(page.getByText("22.22 % a year")).toHaveCount(0);
    await db.source.update({ where: { id: source.id }, data: { approved: true, approvedAt: new Date() } });
    await page.reload();
    await expect(page.getByText("22.22 % a year")).toBeVisible();
    await expect(page.getByText("The World Bank: World Development Indicators (CC BY 4.0)").first()).toBeVisible();
    await signIn(page, "editor@refinerylens.test");
    await page.goto("/editorial/news-leads");
    await expect(page.getByRole("heading", { level: 1, name: "News leads" })).toBeVisible();
    await expect(page.getByText("Unverified lead")).toHaveCount(0);
  } finally {
    await db.marketSeries.delete({ where: { id: series.id } });
    await db.source.delete({ where: { id: source.id } });
    await db.$disconnect();
  }
});

test("business owner filters opportunities by size, sizes one with labelled examples, and saves it privately @mobile", async ({ page }) => {
  await signIn(page, "investor@refinerylens.test");
  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Business opportunities around Dangote");
  expect(await page.locator("body").innerText()).not.toMatch(/dangote (petroleum )?refinery/i);
  await expect(page.getByText("Independent analysis, not an offer")).toBeVisible();
  await page.getByRole("link", { name: /^Micro/ }).click();
  await expect(page).toHaveURL(/scale=micro/);
  await expect(page.getByRole("link", { name: "LPG cylinder refilling and retail" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Crude and condensate supply" })).toHaveCount(0);
  // Market data is never invented when the open-data feed has not been loaded.
  await expect(page.getByText(/Market data is not loaded yet|Some series are not loaded/).first()).toBeVisible();

  await page.getByRole("link", { name: "LPG cylinder refilling and retail" }).click();
  await expect(page.getByText("Statements from the company's own website")).toBeVisible();
  await expect(page.getByText("Not calculated yet.")).toBeVisible();
  await page.getByRole("button", { name: "Fill blanks with example numbers" }).click();
  await expect(page.getByText(/round placeholder numbers/)).toBeVisible();
  await expect(page.getByTestId("headline")).toContainText("NGN");
  await page.getByLabel("Save as a private scenario").fill("E2E LPG kiosk");
  await page.getByRole("button", { name: "Save scenario" }).click();
  await expect(page.getByText("Scenario saved. It is private to you.")).toBeVisible();

  await page.getByLabel("Stage").selectOption("VALIDATING");
  await page.getByLabel("Next step").fill("Ask two bulk suppliers for quotes");
  await page.getByRole("button", { name: /Add to my board|Update board/ }).click();
  await expect(page.getByText("Saved to your opportunity board.")).toBeVisible();

  await page.goto("/opportunities/board");
  await expect(page.getByText("Ask two bulk suppliers for quotes")).toBeVisible();
  await expect(page.getByRole("link", { name: "E2E LPG kiosk" }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // Another user cannot see it.
  await signIn(page, "other@refinerylens.test");
  await page.goto("/opportunities/board");
  await expect(page.getByText("Your board is empty")).toBeVisible();
  await expect(page.getByText("E2E LPG kiosk")).toHaveCount(0);
});

test("sizing tools refuse impossible inputs and show formulas", async ({ page }) => {
  await signIn(page, "investor@refinerylens.test");
  await page.goto("/opportunities/tools/modular-refinery");
  await page.getByRole("button", { name: "Fill blanks with example numbers" }).click();
  await expect(page.getByText("Σ product yield × product price")).toBeVisible();
  await page.getByLabel(/Diesel \(AGO\) yield/).fill("90");
  await expect(page.getByText(/yields add up to 157%/)).toBeVisible();
});
