# RefineryLens

Independent business intelligence on **opportunities around Dangote**, for businesses of every size. **Find the opportunity. Examine the evidence. Size it with your own numbers.**

RefineryLens turns company disclosures, filings and news into reviewed, plain-language research. Every figure carries its source, page, period, scope, units and provenance label; missing data is shown as missing; conflicting sources stay visible; AI-drafted content stays a draft until an editor reviews it.

The **business opportunities hub** maps 14 ways for businesses from micro to enterprise scale to plug into Dangote's Lekki complex: fuel retail and depots, tanker haulage, CNG and LPG, polypropylene conversion and resin distribution, Jet A-1, regional export, crude supply, modular refining, marine logistics and plant services. Each opportunity shows the company-stated facts it rests on, dated independent reports that help or hurt the case, questions to answer and licences to check, plus a sizing tool with visible formulas. Users keep a private opportunity board and saved scenarios. **Find my fit** asks for business size, areas of interest and assets the business already has, then ranks matching opportunities and shows why each is listed. Each opportunity has a **readiness checklist** (progress shows on the board), every sizing tool shows a **what-if table** (each key input moved ±10%), and users can download a **one-page PDF brief** with sources, readiness answers and a saved scenario. Behind it sits the evidence-first research layer (announcements, metrics, conflicts, theses, assistant), built from Dangote's public website.

The **trade hub** (`/hub`) makes RefineryLens the trust and price layer of Nigerian energy trade: a directory of sellers, buyers, hauliers and refineries with **verification** by staff reviewers, reports and suspension; offers and requests with messages; a **price board** of seller-stated prices by state (medians only, across at least three sellers, with dates); a **gas network map** of LPG, CNG and pipeline-gas supply, delivery and demand by state, with gaps highlighted; **delivery jobs** (post a load, collect quotes, accept one, confirm delivery on both sides); and **recurring supply agreements** whose deliveries count only when both sides confirm them. **Plans and pricing** (`/plans`) lists the revenue lines that can start now (users register interest; no payment is taken) and marks escrow, trade finance and insurance as coming soon through licensed partners. RefineryLens never trades fuel, holds money or sets prices.

Product copy says "Dangote", never "Dangote refinery" or the company's full refinery name; that is a standing product decision. The only exception is the hidden news search query in `prisma/seed-dangote.ts`. RefineryLens is not affiliated with, endorsed by or sponsored by Dangote or any Dangote company, the opportunities are analysis rather than offers, and nothing in it is investment or financial advice.

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

Production build: `npm run build && npm start`. Optionally run `npm run worker` as a separate process for background document extraction, alert emails and open-data refreshes (see [Background jobs](#background-jobs)). `npm run ingest` pulls the [open data feeds](#open-data-feeds) once.

`npm run db:reset` drops and recreates the schema and reseeds. The seed **truncates every table**, so never run it against a database with real users.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run worker` | Background job worker (document extraction, alert emails, open-data refreshes) |
| `npm run ingest` | Pull every available open-data feed once and print the result |
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
| `trader@refinerylens.test` | Trade hub seller and buyer | Ikeja Gas Hub (sample, verified): price reports, listings, gas sites, a recurring supply to the Lekki kiosks, a proposal waiting for acceptance |
| `haulier@refinerylens.test` | Trade hub haulier | Eko Bobtail Logistics (sample, verified): quotes on delivery jobs and a delivered, confirmed job |
| `admin@refinerylens.test` | Administrator | Users, roles, plans, jobs, audit log and integration status (but **not** users' private files) |

The trade hub is seeded with 15 **sample businesses** (`prisma/seed-hub.ts`), all invented and labelled "Sample business" wherever they appear, with prices and dates relative to the seed time. Their owners sign in as `sample-<key>@sample.refinerylens.test` with the same password. Editors review hub businesses at **Hub review** (`/hub/review`).

### Two companies, deliberately different

**Dangote (Lekki complex)** (`prisma/seed-dangote.ts`, slug `dangote`): facts taken from the company's public website, retrieved 25 October 2026, labelled *Company-disclosed* with URLs and retrieval times. They are loaded **as drafts awaiting editorial review**, not as published content, because the spec requires AI-prepared summaries to stay drafts until a human checks them. Financial metrics the company has not published are stored as *Not publicly disclosed*. Two source conflicts found on the site (an offer described as open versus a page saying there are no active public offerings; processing versus capacity wording) are recorded for an editor to review. No Dangote branding, logos or imagery are used. Sign in as the editor to review and publish them.

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
| **Free open-data feeds** (oil and product prices, Nigerian macro data, global refinery inventory, news leads) | Implemented; see [Open data feeds](#open-data-feeds). Keyless feeds are on by default; EIA needs a free key | `EIA_API_KEY` for EIA; nothing for the rest. An editor approves each source before readers see it |
| **Exchange or regulator data feeds** (share prices, filings) | Not connected; no share prices or tickers are shown | Licensed feeds from the relevant exchange or regulator |
| **Paywalled news** | Not ingested; only openly available sources, linked rather than copied | Content licences with publishers |
| **Live plant data** | Not available; the UI states there is no access to live plant systems | Would require a direct agreement with the company |

The admin screen shows the live status of each integration.

### Open data feeds

Free public APIs that give sector-wide and country context. They are cached in PostgreSQL (`MarketSeries`, `MarketObservation`, `RefineryAsset`, `NewsLead`, with every attempt in `IngestionRun`), refreshed by the worker every `OPEN_DATA_INTERVAL_HOURS` (default 12) or with `npm run ingest`, and never fetched by a page. Each provider creates an **unapproved** `Source` carrying its licence notes; readers only see a feed's data after an editor approves that source. Every value keeps its publisher, publisher period label, units, retrieval time and request URL (API keys removed). None of it is company data, and the UI says so.

| Feed | What RefineryLens takes | Scope | Key | Licence and conditions |
| --- | --- | --- | --- | --- |
| [EIA Open Data API](https://www.eia.gov/opendata/) | Brent and WTI spot; US Gulf Coast gasoline, ULSD and jet spot; weekly US refinery utilization; monthly Nigerian crude production | Global market, Nigeria | `EIA_API_KEY` (free) | US government data, public domain; cite EIA |
| [World Bank Indicators API](https://data.worldbank.org/) | Nigeria: official NGN/USD annual average, inflation, GDP, fuel share of imports and exports | Nigeria macro | None | CC BY 4.0; attribute "The World Bank: World Development Indicators" |
| [ExchangeRate-API open access](https://www.exchangerate-api.com/docs/free) | Daily USD/NGN reference rate (not the CBN official rate) | Nigeria macro | None | Attribution link required on pages showing rates; no redistribution of raw rates, so they are never exported |
| [Climate TRACE](https://climatetrace.org/) | Global oil and gas refining assets: name, country, type, capacity (bbl/day), owners, coordinates, estimated CO₂e | Global refinery directory | None | CC BY 4.0, commercial use allowed with attribution; modelled estimates, not disclosures |
| [GDELT DOC 2.0](https://www.gdeltproject.org/) | Headlines and links mentioning covered companies (from `Company.newsQuery`), as editor-only **news leads** | Company news discovery | None | Free with citation; only headline, link, outlet and date are stored |

RefineryLens also shows an **indicative 3-2-1 crack spread** calculated from the EIA prices, labelled as an estimate with its formula; it is a benchmark, not any refiner's margin.

Checked and deliberately **not** ingested: UN Comtrade (commercial use and redistribution need written UN permission); FRED (its oil series are EIA data, taken at source, and its terms restrict third-party series); the OPEC basket price (no documented API or reuse grant); CBN, NBS, NUPRC and NMDPRA (no documented machine-readable API; upload their reports as documents instead); JODI Oil (bulk files, a candidate for a later importer); price-reporting agencies such as Platts and Argus (paid); AIS ship tracking (free tiers such as aisstream.io are live streams with no history, so they need a stream consumer rather than a periodic feed; left for a later release).

Other features reuse the cached data through `src/server/opendata/index.ts`: `getMarketSignals(keys, actor)` returns the latest value per series key with its source, period, units, retrieval time, attribution and licence, and `listRefineryAssets(filter, actor)` returns the refinery directory. Both apply the same approval rule.

---

## Architecture

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React Server Components, server actions), React 19, TypeScript |
| Styling | Tailwind CSS 3. Atlantic navy carries the structure (`ink`: #0B1530 sidebar and headings, Navy 800 #182A5A data marks, Mist #F3F5FC panels and table headers), Naija green #087C47 marks actions, verified businesses and links (`brand`), Signal amber #B7791F is for warnings only, white is the page; a thin green-white-green line is the single flag reference. Inter, Source Serif 4 and JetBrains Mono (for numbers) self-hosted via Fontsource; Lucide icons. Times are shown in West Africa Time (Lagos) |
| Charts | Recharts, always with an accessible table alternative |
| Database | PostgreSQL via Prisma 6; migrations in `prisma/migrations` |
| Auth | Custom, see above. Chosen over an auth library to keep sessions server-side and auditable with no third-party dependency |
| AI | `@anthropic-ai/sdk`, optional |
| Tests | Vitest (unit and integration against a real Postgres test database), Playwright (browser) |

### Permissions

Role checks live in `src/lib/permissions.ts` and are enforced in server actions and services, not only in the UI. Private documents and theses are filtered by `ownerId` at the query level and again in code, so not even administrators can read them. The assistant's retrieval applies the same rule, which is covered by integration and browser tests.

### Background jobs

Uploads enqueue a `document.extract` job. By default the web process drains the queue right after an upload (`INLINE_JOBS` unset). In production set `INLINE_JOBS=false` and run `npm run worker` as its own process. The worker also queues an `opendata.ingest` job whenever the open-data feeds are due, and administrators can queue one from the admin screen. The worker also sends alert emails once a minute when email is configured: one message per user, covering every alert that has become visible (digest alerts become visible at 07:00 UTC daily, or Monday for weekly).

### Research assistant

1. Retrieval scores published announcements, published metrics, unresolved conflicts, approved public documents, and **only the asking user's** private pages and theses.
2. The question is classified (what changed, explain a report, general concept, challenge my thesis, what is missing, lookup).
3. Evidence mode composes a structured answer: direct answer, general explanation kept separate from company evidence, supporting evidence with citations, RefineryLens calculations with formulas, possible implications (never buy or sell advice), uncertainties and missing information.
4. With an API key, Claude produces the same structure. Document text is passed as untrusted data, and text that looks like instructions is flagged rather than followed.

---

## Screens

Landing, sign-in and registration (signing in opens the opportunities hub); **Trade hub** (overview, directory, business pages, offers and requests, price board, gas network map, delivery jobs and job pages, recurring supply and agreement pages, my business, hub review for editors); **Plans and pricing**; **Business opportunities** explorer with size and area filters, opportunity detail pages, **Sizing tools** (resale margin and payback, tanker haulage, polypropylene converter, import parity, modular refinery margin) and **My opportunity board** (private pipeline and saved scenarios); **Overview** dashboard; **Company profile**; **Announcements and news** with detail pages; **Financial reports**; **Operational indicators**; **Risk center**; **Market & macro context** (benchmarks, crack spread, Nigerian macro data); **Global refineries** (directory with West Africa filter); **My investment thesis** (list, create, edit, detail with versions and evidence review); **Research assistant** with saved conversations; **Watchlist and alerts**; **Source library** and document viewer; **Corrections log**; **Account and plan**; **Editorial desk** (announcements, documents, news leads, sources, conflicts); **Administration**.

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
- **Trade hub guardrails** (`src/lib/hub/rules.ts`). Price board: past prices only (never future or planned), charged within 30 days, sellers confirm each is a price actually charged, typo bounds per product, each seller counts once, medians published only from three or more sellers in the last 14 days, and no individual seller's price or range is ever shown; copy warns against using the board or messages to coordinate prices. Fraud: unverified businesses are labelled "Not verified" and never look official; names of well-known refiners and majors are shown as "Name hidden until verified"; changing a verified business's name, CAC or licence numbers removes the badge; suspension hides the business, its listings, prices and sites at once; advance-payment warnings appear on every trading screen. Data quality: listings expire after 30 days; gas sites are flagged after 60 days without reconfirmation and drop off after 180. Records: delivery jobs and supply deliveries count only once both sides confirm. Promoted listings are always labelled. Supply agreements and quotes are private to the parties.
- Opportunities are RefineryLens analysis, never presented as Dangote offers. Their anchors are company-stated facts with page links; their context notes are dated reports with provenance labels. The catalogue states no opportunity sizes; sizing tools start empty, label example numbers as placeholders, prefill market data only from approved open-data series with attribution, and refuse inconsistent inputs. Saved scenarios store inputs only and are recalculated on display.

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
scripts/ingest.ts        one-off open-data refresh
src/
  app/                   routes: (auth), (app) screens, actions/, api/
  components/            UI components
  lib/                   permissions, calculations, labels, formatting, plans
  server/                auth, storage (local, S3), email, extraction, jobs, integrations
    services/            announcements, metrics, documents, thesis, alerts, users, market
    opendata/            open-data catalogue, provider adapters, ingestion, read API
    assistant/           retrieval, intent classification, answer composition
tests/
  unit/  integration/    Vitest
  e2e/                   Playwright
```
