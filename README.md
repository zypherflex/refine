# RefineryLens

Independent business intelligence on **opportunities around Dangote**, for businesses of every size. **Find the opportunity. Examine the evidence. Size it with your own numbers.**

RefineryLens turns company disclosures, filings and news into reviewed, plain-language research. Every figure carries its source, page, period, scope, units and provenance label; missing data is shown as missing; conflicting sources stay visible; AI-drafted content stays a draft until an editor reviews it.

The **business opportunities hub** maps 14 ways for businesses from micro to enterprise scale to plug into Dangote's Lekki complex: fuel retail and depots, tanker haulage, CNG and LPG, polypropylene conversion and resin distribution, Jet A-1, regional export, crude supply, modular refining, marine logistics and plant services. Each opportunity shows the company-stated facts it rests on, dated independent reports that help or hurt the case, questions to answer and licences to check, plus a sizing tool with visible formulas. Users keep a private opportunity board and saved scenarios. **Find my fit** asks for business size, areas of interest and assets the business already has, then ranks matching opportunities and shows why each is listed. Each opportunity has a **readiness checklist** (progress shows on the board), every sizing tool shows a **what-if table** (each key input moved ±10%), and users can download a **one-page PDF brief** with sources, readiness answers and a saved scenario. The **trade hub** connects **sellers, buyers, delivery partners and refineries**: businesses post product offers, buy requests and delivery capacity, see matching listings from the other side of the deal, and message each other privately. Anyone can post straight away; a *Verified* badge appears once an administrator has checked the business's CAC registration and licences, and names of well-known refiners stay hidden until verified. The hub's **gas network** maps LPG and CNG supply across Nigeria's 36 states and the FCT: businesses list their terminals, depots, refill plants, cylinder retail points, CNG stations and gas truck bases, and the map shows supply points, delivery coverage, buyer demand and gaps (demand with no supply or delivery) by state, with the nearest supply elsewhere. Site details are as stated by each business and are flagged as possibly out of date when not confirmed for 90 days. The **price board** shows what sellers charged for LPG, CNG, diesel, petrol and kerosene by state, only as medians across at least three sellers, with week-on-week change. **Delivery jobs** let any business post a load, delivery partners quote, the poster accepts one and both sides confirm delivery. **Supply agreements** record standing arrangements; the seller logs each delivery and the buyer confirms or disputes it, building each seller's public delivery record. RefineryLens only introduces businesses and carries their messages: it takes no payments, holds no goods and guarantees no one. Behind it sits the evidence-first research layer (announcements, metrics, conflicts, theses, assistant), built from Dangote's public website.

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
| `admin@refinerylens.test` | Administrator | Users, roles, plans, jobs, audit log and integration status (but **not** users' private files); trade hub verification and reports |
| `seller@refinerylens.test` | Trade hub seller | Ikeja Energy Supplies (demo), verified: LPG and diesel offers, an enquiry from Kano Gas to answer |
| `buyer@refinerylens.test` | Trade hub buyer | Kano Gas Kiosks (demo), verification requested: an LPG buy request and an unread reply |
| `haulier@refinerylens.test` | Trade hub delivery partner | Northern Corridor Haulage (demo), verified: tanker and LPG truck capacity |
| `refinery@refinerylens.test` | Trade hub refinery | Lagoon Coast Refining Co. (fictional demo), verified: polypropylene offer and a crude request |
| `converter@refinerylens.test` | Trade hub buyer | Ogun Resin Converters (demo), unverified: polypropylene and CNG buy requests |
| `surulere@`, `agege@`, `kanobulk@refinerylens.test` | Trade hub sellers | Extra demo sellers that give Lagos and Kano enough price reports for a median |
| `cng@refinerylens.test` | Trade hub seller | Abuja CNG Mobility (demo), verified: CNG stations in Abuja and Lagos and a compression site in Kogi |

Every trade hub business in the seed (`prisma/seed-hub.ts`) is fictional, named "(demo)", flagged as a demo account in the UI, and its prices are labelled as demo figures.

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
| **Card payments** (Pro plan, Paystack) | Implemented and tested against mocked Paystack responses; the plan changes only after Paystack verifies the full amount, through the return verify call or the HMAC-signed webhook | A Paystack account: `PAYMENT_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY`, optional `PRO_PLAN_PRICE_NGN`; webhook URL `{APP_URL}/api/payments/paystack/webhook`. Team plans are still assigned by an administrator |
| **SMS and WhatsApp alerts, morning price digest** | Implemented for Termii, Africa's Talking (SMS) and WhatsApp Cloud API (template messages); tested against mocked APIs. Users add a phone and opt in under Account; the worker sends trade hub alerts and one digest a day | One provider's account and keys: `TEXT_PROVIDER` plus `TERMII_*`, `AT_*` or `WHATSAPP_*` (see `.env.example`); WhatsApp needs an approved template with one body parameter |
| **USSD price check** | Implemented for Africa's Talking USSD; tested | An Africa's Talking USSD code pointed at `{APP_URL}/api/ussd?token={USSD_TOKEN}` |
| **CAC registry lookup** for verification | Implemented with Dojah's CAC lookup; results appear in the verification queue, never verify on their own | A Dojah account: `CAC_LOOKUP_PROVIDER=dojah`, `DOJAH_APP_ID`, `DOJAH_SECRET_KEY` |
| **Gas site geocoding** | Implemented with OpenStreetMap Nominatim, one lookup a second in the worker; tested | `GEOCODER=nominatim` and `NOMINATIM_EMAIL`; use your own or a paid Nominatim for heavy use |
| **Escrow and trade finance** | Not shipped | A licensed payment or lending partner (see the strategy playbook) |
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
| Styling | Tailwind CSS 3 with a green-and-white brand palette (`ink` neutrals, `brand` green), a green-white-green band and an adire-inspired pattern; Inter and Source Serif 4 self-hosted via Fontsource; Lucide icons. Times are shown in West Africa Time (Lagos) |
| Charts | Recharts, always with an accessible table alternative |
| Database | PostgreSQL via Prisma 6; migrations in `prisma/migrations` |
| Auth | Custom, see above. Chosen over an auth library to keep sessions server-side and auditable with no third-party dependency |
| AI | `@anthropic-ai/sdk`, optional |
| Tests | Vitest (unit and integration against a real Postgres test database), Playwright (browser) |

### Permissions

Role checks live in `src/lib/permissions.ts` and are enforced in server actions and services, not only in the UI. Private documents and theses are filtered by `ownerId` at the query level and again in code, so not even administrators can read them. Trade hub conversations are readable only by the user who made the enquiry and the owner of the business it went to; administrators verify, suspend and handle reports (`can.moderateHub`) without access to messages. The assistant's retrieval applies the same rule, which is covered by integration and browser tests.

### Background jobs

Uploads enqueue a `document.extract` job. By default the web process drains the queue right after an upload (`INLINE_JOBS` unset). In production set `INLINE_JOBS=false` and run `npm run worker` as its own process. The worker also queues an `opendata.ingest` job whenever the open-data feeds are due, and administrators can queue one from the admin screen. The worker also sends alert emails once a minute when email is configured: one message per user, covering every alert that has become visible (digest alerts become visible at 07:00 UTC daily, or Monday for weekly).

### Research assistant

1. Retrieval scores published announcements, published metrics, unresolved conflicts, approved public documents, and **only the asking user's** private pages and theses.
2. The question is classified (what changed, explain a report, general concept, challenge my thesis, what is missing, lookup).
3. Evidence mode composes a structured answer: direct answer, general explanation kept separate from company evidence, supporting evidence with citations, RefineryLens calculations with formulas, possible implications (never buy or sell advice), uncertainties and missing information.
4. With an API key, Claude produces the same structure. Document text is passed as untrusted data, and text that looks like instructions is flagged rather than followed.

---

## Screens

Landing, sign-in and registration (signing in opens the opportunities hub); **Business opportunities** explorer with size and area filters, opportunity detail pages, **Sizing tools** (resale margin and payback, tanker haulage, polypropylene converter, import parity, modular refinery margin) and **My opportunity board** (private pipeline and saved scenarios); **Trade hub** (browse offers, buy requests and delivery capacity by product, location and verification; listing pages with matches; business profiles; **Gas network** (schematic state map with supply, delivery, demand and gap layers for bulk LPG, LPG cylinders and CNG; per-state sites and nearest supply; site pages; add and confirm sites); **Price board**; **Delivery jobs** (open jobs, post a job, quotes, award, confirmation); **Supply agreements** (propose, accept, log and confirm deliveries, delivery record); **Refineries**; **Hub inbox** with private conversations; **My business** with profile, verification and listings; **Trade hub moderation** for administrators); **Overview** dashboard; **Company profile**; **Announcements and news** with detail pages; **Financial reports**; **Operational indicators**; **Risk center**; **Market & macro context** (benchmarks, crack spread, Nigerian macro data); **Global refineries** (directory with West Africa filter); **My investment thesis** (list, create, edit, detail with versions and evidence review); **Research assistant** with saved conversations; **Watchlist and alerts**; **Source library** and document viewer; **Corrections log**; **Account and plan**; **Editorial desk** (announcements, documents, news leads, sources, conflicts); **Administration**.

**Web and mobile app.** RefineryLens is an installable web app (PWA): on Android and desktop Chrome or Edge an "Install the RefineryLens app" button appears in the menu; on iPhone and iPad use Safari's Share, then Add to Home Screen. It opens full screen on the trade hub, with shortcuts to prices, the gas network, jobs and the inbox. On phones a bottom tab bar keeps Hub, Prices, Gas map, Jobs and Inbox one tap away. The service worker (`public/sw.js`) always loads pages from the network; offline, it shows the last copy of a page opened on that device, or an offline page. Private pages (inbox, settings, admin, documents, theses, assistant) are never stored, and signing out clears stored pages. Installing needs HTTPS in production.

Colour system: Atlantic navy (`#0B1530`, the `ink` and `navy` scales in `tailwind.config.ts`) carries structure, Naija green (`brand`) marks actions, links and verified businesses, white is the page, and amber is kept for warnings. A thin green-white-green band is the one flag reference.

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
