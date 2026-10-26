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
  await Promise.all([page.waitForURL(/\/dashboard/), page.getByRole("button", { name: "Sign in" }).click()]);
  sessions.set(email, (await page.context().cookies()).filter((c) => c.name === "rl_session"));
}

async function selectCompany(page: Page, slug: string) {
  await Promise.all([page.waitForLoadState("networkidle"), page.locator("#company-switch").selectOption(slug)]);
  await expect(page.locator("#company-switch")).toHaveValue(slug);
}

test("landing page presents RefineryLens as independent @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dangote Refinery, understood");
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
  await selectCompany(page, "dangote-petroleum-refinery");
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
