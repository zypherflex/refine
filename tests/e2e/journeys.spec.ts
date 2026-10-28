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
  await Promise.all([page.waitForURL(/\/hub/), page.getByRole("button", { name: "Sign in" }).click()]);
  sessions.set(email, (await page.context().cookies()).filter((c) => c.name === "rl_session"));
}

async function selectCompany(page: Page, slug: string) {
  await Promise.all([page.waitForLoadState("networkidle"), page.locator("#company-switch").selectOption(slug)]);
  await expect(page.locator("#company-switch")).toHaveValue(slug);
}

test("landing page presents RefineryLens as a trade hub and as independent @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Where sellers, buyers, delivery partners");
  await expect(page.getByRole("heading", { name: "Set up one profile, take any of the four roles." })).toBeVisible();
  await expect(page.getByText("not affiliated with, endorsed by or sponsored by")).toBeVisible();
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

test("trade hub: a buyer enquires about a refinery's offer, the refinery replies, and an admin verifies a business @mobile", async ({ page }) => {
  // Start from no conversation between these two demo businesses, and Kano Gas waiting for verification.
  const db = new PrismaClient();
  await db.hubThread.deleteMany({ where: { starter: { email: "converter@refinerylens.test" } } });
  await db.hubBusiness.updateMany({ where: { owner: { email: "buyer@refinerylens.test" } }, data: { verification: "PENDING_REVIEW", verifiedAt: null } });
  await db.$disconnect();

  await signIn(page, "converter@refinerylens.test");
  await page.goto("/hub?product=pp");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sellers, buyers, delivery partners and refineries");
  await page.getByRole("link", { name: "Polypropylene resin, injection and raffia grades" }).click();
  await expect(page.getByText("✓ Verified").first()).toBeVisible();
  await page.getByLabel("Your message").fill("We need 40 tonnes of raffia grade a month in Sagamu. Can you quote?");
  await Promise.all([page.waitForURL(/\/hub\/inbox\/[a-z0-9]+$/), page.getByRole("button", { name: "Send message" }).click()]);
  await expect(page.getByText("We need 40 tonnes of raffia grade")).toBeVisible();

  await signIn(page, "refinery@refinerylens.test");
  await page.goto("/hub/inbox");
  await page.getByRole("link", { name: /Ogun Resin Converters/ }).click();
  await page.getByLabel("Reply").fill("Yes. 40 tonnes monthly is fine; quote follows by Friday.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("quote follows by Friday")).toBeVisible();

  await signIn(page, "admin@refinerylens.test");
  await page.goto("/admin/hub");
  await expect(page.getByText("RC 0000002 (demo)")).toBeVisible();
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verification requests (0)" })).toBeVisible();
});

test("price board, delivery job and supply agreement work end to end @mobile", async ({ page }) => {
  const db = new PrismaClient();
  await db.deliveryJob.deleteMany({ where: { title: "E2E 10 tonnes LPG" } });
  await db.$disconnect();

  await signIn(page, "buyer@refinerylens.test");
  await page.goto("/hub/prices?item=lpg_retail_kg");
  await expect(page.getByRole("heading", { level: 1, name: "Price board" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Lagos ₦1,300/ })).toBeVisible();
  await expect(page.getByText("Includes demo sellers")).toBeVisible();

  await page.goto("/hub/jobs/new");
  await page.getByLabel("What needs moving? *").fill("E2E 10 tonnes LPG");
  await page.getByLabel("LPG (cooking gas)").check();
  await page.getByLabel("Quantity *").fill("10");
  await page.getByLabel("Unit *").selectOption("tonnes");
  await page.getByLabel("From *").selectOption("Lagos");
  await page.getByLabel("To *").selectOption("Kano");
  await Promise.all([page.waitForURL(/\/hub\/jobs\/(?!new)[a-z0-9]+$/), page.getByRole("button", { name: "Post job and collect quotes" }).click()]);
  const jobUrl = page.url();

  await signIn(page, "haulier@refinerylens.test");
  await page.goto(jobUrl);
  await page.getByLabel("Your price for the whole job (₦) *").fill("1100000");
  await page.getByRole("button", { name: "Send quote" }).click();
  await expect(page.getByText("Quote sent.")).toBeVisible();

  await signIn(page, "buyer@refinerylens.test");
  await page.goto(jobUrl);
  await page.getByRole("button", { name: "Accept this quote" }).click();
  await expect(page.getByRole("heading", { name: /Awarded to Northern Corridor Haulage/ })).toBeVisible();
  await page.getByRole("button", { name: "Confirm the load arrived" }).click();
  await expect(page.getByText(/confirmed delivery/).first()).toBeVisible();

  await page.goto("/hub/supply");
  await page.getByRole("link", { name: /20 tonnes of LPG/ }).click();
  await expect(page.getByText("Waiting for buyer")).toBeVisible();
});
