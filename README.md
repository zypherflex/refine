# RefineryLens

Independent investor intelligence for refinery businesses. **Understand the change. Examine the evidence. Reassess your investment thesis.**

RefineryLens turns company disclosures, filings and news into reviewed, plain-language research. Every figure carries its source, page, period, scope, units and provenance label; missing data is shown as missing; conflicting sources stay visible; AI-drafted content stays a draft until an editor reviews it.

The first coverage is **Dangote Petroleum Refinery & Petrochemicals**, built from its public website. The platform is multi-company. RefineryLens is not affiliated with, endorsed by or sponsored by any company it covers, and nothing in it is investment advice.

---

## Contents

1. [Quick start](#quick-start)
2. [Demo accounts and data](#demo-accounts-and-data)
3. [What works now and what needs credentials](#what-works-now-and-what-needs-credentials)
4. [Architecture](#architecture)
5. [Screens](#screens)
6. [Content and trust rules](#content-and-trust-rules)
7. [Testing](#testing)
8. [Deploying to production](#deploying-to-production)
9. [Project layout](#project-layout)

---

## Quick start

Requirements: **Node.js 20+** (developed on 22) and **PostgreSQL 14+** (developed on 16).

```bash
# 1. Install dependencies
npm install

# 2. Configure the environment
cp .env.example .env
#    then set DATABASE_URL and a long random SESSION_SECRET (openssl rand -hex 32)

# 3. Create the database schema
createdb refinerylens            # or create it any way you like
npm run db:migrate

# 4. Load the Dangote source facts and the fictional demo company
npm run db:seed

# 5. Run
npm run dev                      # http://localhost:3000
```

Production build: `npm run build && npm start`. Optionally run `npm run worker` as a separate process for background document extraction and alert emails (see [Background jobs](#background-jobs)).

`npm run db:reset` drops and recreates the schema and reseeds. The seed **truncates every table**, so never run it against a database with real users.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run worker` | Background job worker (document extraction) |
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Truncate and load demo users, Dangote source facts and fictional demo data |
| `npm run db:reset` | Reset schema and reseed |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit and integration tests (needs a `refinerylens_test` database) |
| `npm run test:e2e` | Playwright browser tests against a running, seeded app |

---

## Demo accounts and data

All demo accounts use the password **`RefineryLens-demo-2026`**.

| Email | Role | Use it to see |
| --- | --- | --- |
| `investor@refinerylens.test` | Investor (Pro plan) | Dashboard, saved thesis with pending evidence suggestions, alerts, private upload, assistant |
| `other@refinerylens.test` | Investor (Free plan) | A second investor, for checking that private files and theses are isolated |
| `analyst@refinerylens.test` | Analyst | Drafting announcements and metrics in the editorial desk |
| `editor@refinerylens.test` | Editor | Reviewing, publishing, correcting and retracting; approving sources and resolving conflicts |
| `admin@refinerylens.test` | Administrator | Users, roles, plans, jobs, audit log and integration status (but **not** users' private files) |

### Two companies, deliberately different

**Dangote Petroleum Refinery & Petrochemicals** (`prisma/seed-dangote.ts`): facts taken from the public website `refinery.dangote.com`, retrieved 25 October 2026, labelled *Company-disclosed* with URLs and retrieval times. They are loaded **as drafts awaiting editorial review**, not as published content, because the spec requires AI-prepared summaries to stay drafts until a human checks them. Financial metrics the company has not published are stored as *Not publicly disclosed*. Two source conflicts found on the site (an offer described as open versus a page saying there are no active public offerings; processing versus capacity wording) are recorded for an editor to review. No Dangote branding, logos or imagery are used. Sign in as the editor to review and publish them.

**Lagoon Coast Refining Co. (fictional demo)** (`prisma/seed-demo.ts`): an invented company that exercises every feature with realistic-looking data, including generated PDF reports stamped *FICTIONAL DEMONSTRATION DOCUMENT - NOT A REAL COMPANY - NOT DANGOTE RESULTS*, published, corrected, retracted and superseded announcements, an unresolved conflict and a risk register. Every page for it shows a fictional-data banner.

---

## What works now and what needs credentials

### Works out of the box

| Capability | Notes |
| --- | --- |
| Accounts, sign-in, roles (User, Analyst, Editor, Admin) | Custom auth: bcrypt (cost 12) password hashes, DB-backed sessions with hashed tokens, httpOnly cookies, rate-limited sign-in |
| Private and public document storage | Local disk outside the web root (`STORAGE_DIR`), owner-only access for private files |
| PDF and text upload, page extraction, figure suggestions | `unpdf` text extraction; figures become *draft* metrics for review |
| Background jobs | PostgreSQL-backed queue (`FOR UPDATE SKIP LOCKED`) |
| Editorial workflow | Draft, review, publish, correct, retract, supersede, duplicate; public corrections log |
| Thesis tracking | Assumptions, indicators with thresholds, evidence suggestions, version history |
| In-app alerts | Immediate, daily and weekly digests; corrections and retractions always immediate |
| Research assistant, **evidence mode** | Retrieval plus extractive, fully cited answers with no language model |
| Calculations | Growth, margins, free cash flow, net debt, utilization, cash conversion, with comparability checks |

### Needs credentials or a commercial agreement

| Integration | Status in this release | What is needed |
| --- | --- | --- |
| **Claude language model** for the assistant | Implemented; switches on when a key is present | `ANTHROPIC_API_KEY` (optional `ANTHROPIC_MODEL`, default `claude-opus-5-5`). Answers are structured output, and claims whose citations do not match retrieved evidence are dropped |
| **S3-compatible object storage** (AWS S3, Cloudflare R2, MinIO) | Implemented and verified against a local S3 server; private, server-side encrypted objects | A bucket and credentials: `STORAGE_DRIVER=s3` plus `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and `S3_ENDPOINT` for non-AWS providers) |
| **Email alert delivery** (SMTP) | Implemented and verified against a local mail server. Users opt in on the alerts page; immediate alerts and daily or weekly digests are emailed by the worker, failed sends are retried | An SMTP account with any provider: `EMAIL_PROVIDER=smtp`, `SMTP_URL`, `EMAIL_FROM`, and `npm run worker` running. Until all are set, the UI says alerts are in-app only |
| **Push notifications** | Not shipped | A push provider (for example web push keys) and an adapter |
| **Payments** (Pro and Team plans) | Disabled; admins assign plans | A payment provider account (for example Stripe or Paystack) and adapter |
| **Exchange or regulator data feeds** (prices, filings) | Not connected; no share prices or tickers are shown | Licensed feeds from the relevant exchange or regulator |
| **Paywalled news** | Not ingested; only openly available sources, linked rather than copied | Content licences with publishers |
| **Live plant data** | Not available; the UI states there is no access to live plant systems | Would require a direct agreement with the company |

The admin screen shows the live status of each integration.

---

## Architecture

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React Server Components, server actions), React 19, TypeScript |
| Styling | Tailwind CSS 3 with a green-and-white brand palette (`ink` neutrals, `brand` green), a green-white-green band and an adire-inspired pattern; Inter and Source Serif 4 self-hosted via Fontsource; Lucide icons. Times are shown in West Africa Time (Lagos) |
| Charts | Recharts, always with an accessible table alternative |
| Database | PostgreSQL via Prisma 6; migrations in `prisma/migrations` |
| Auth | Custom, see above. Chosen over an auth library to keep sessions server-side and auditable with no third-party dependency |
| AI | `@anthropic-ai/sdk`, optional |
| Tests | Vitest (unit and integration against a real Postgres test database), Playwright (browser) |

### Permissions

Role checks live in `src/lib/permissions.ts` and are enforced in server actions and services, not only in the UI. Private documents and theses are filtered by `ownerId` at the query level and again in code, so not even administrators can read them. The assistant's retrieval applies the same rule, which is covered by integration and browser tests.

### Background jobs

Uploads enqueue a `document.extract` job. By default the web process drains the queue right after an upload (`INLINE_JOBS` unset). In production set `INLINE_JOBS=false` and run `npm run worker` as its own process. The worker also sends alert emails once a minute when email is configured: one message per user, covering every alert that has become visible (digest alerts become visible at 07:00 UTC daily, or Monday for weekly).

### Research assistant

1. Retrieval scores published announcements, published metrics, unresolved conflicts, approved public documents, and **only the asking user's** private pages and theses.
2. The question is classified (what changed, explain a report, general concept, challenge my thesis, what is missing, lookup).
3. Evidence mode composes a structured answer: direct answer, general explanation kept separate from company evidence, supporting evidence with citations, RefineryLens calculations with formulas, possible implications (never buy or sell advice), uncertainties and missing information.
4. With an API key, Claude produces the same structure. Document text is passed as untrusted data, and text that looks like instructions is flagged rather than followed.

---

## Screens

Landing, sign-in and registration; **Overview** dashboard; **Company profile**; **Announcements and news** with detail pages; **Financial reports**; **Operational indicators**; **Risk center**; **My investment thesis** (list, create, edit, detail with versions and evidence review); **Research assistant** with saved conversations; **Watchlist and alerts**; **Source library** and document viewer; **Corrections log**; **Account and plan**; **Editorial desk** (announcements, documents, sources, conflicts); **Administration**.

All screens are responsive from phone to desktop widths, keyboard navigable with visible focus and a skip link, and use semantic headings and labels.

---

## Content and trust rules

These are enforced in code and covered by tests:

- Only **published** content reaches readers or the assistant. Drafts, including AI drafts, need editor review.
- Every announcement and metric carries a provenance label: company-disclosed, regulator or exchange, independent report, analyst estimate, user assumption or unverified.
- Group, refinery and sector figures are never combined without a stated reconciliation; incomparable periods are refused rather than calculated.
- Conflicts stay visible until an editor resolves them, with the resolution recorded.
- Corrections and retractions are logged publicly and alert watchers immediately.
- Evidence suggestions never edit a user's thesis; the user accepts or dismisses them.
- No share prices, tickers or offer deadlines are shown unless an editor has verified them against a primary source.

---

## Testing

```bash
# Unit and integration (creates and migrates refinerylens_test)
createdb refinerylens_test
npm test

# Browser tests: build, seed and start the app, then run
npm run build && npm run db:seed && npm start &
npm run test:e2e
# If Playwright's bundled Chromium is not installed, point it at one:
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

Current results: **59 unit and integration tests** and **10 browser tests** (desktop and mobile) passing. They cover calculations and comparability, upload validation and extraction, permissions, the publication and correction workflow (including an editor publishing and correcting in the browser, and the update reaching a reader's thesis), alerts, email delivery and digests, S3 storage, private-file isolation (database, assistant and HTTP), assistant citations and insufficient-evidence handling, honest unavailable states for Dangote, and no horizontal scrolling on mobile.

---

## Deploying to production

1. Provision PostgreSQL and set `DATABASE_URL`, a fresh `SESSION_SECRET` and `APP_URL`.
2. `npm ci && npm run db:migrate && npm run build`.
3. Do **not** run the seed. Create the first administrator by registering and then promoting the account in the database (`UPDATE "User" SET role='ADMIN' WHERE email='…'`).
4. Run `npm start` behind HTTPS, and `npm run worker` as a second process with `INLINE_JOBS=false`.
5. Put `STORAGE_DIR` on persistent, backed-up storage, or set `STORAGE_DRIVER=s3` with a private bucket.
6. To email alerts, set `EMAIL_PROVIDER=smtp`, `SMTP_URL` and `EMAIL_FROM`.
7. Before publishing third-party content, confirm the licence for each source in the editorial desk.

---

## Project layout

```
prisma/
  schema.prisma          data model
  migrations/            SQL migrations
  seed.ts                demo users, theses, watchlists, private uploads
  seed-dangote.ts        Dangote website facts (drafts awaiting review)
  seed-demo.ts           fictional demo company and generated PDFs
scripts/worker.ts        background job worker
src/
  app/                   routes: (auth), (app) screens, actions/, api/
  components/            UI components
  lib/                   permissions, calculations, labels, formatting, plans
  server/                auth, storage (local, S3), email, extraction, jobs, integrations
    services/            announcements, metrics, documents, thesis, alerts, users
    assistant/           retrieval, intent classification, answer composition
tests/
  unit/  integration/    Vitest
  e2e/                   Playwright
```
