# RefineryLens

Fuel and cooking gas for **Nigerians everywhere**: mainly people living in Nigeria, and Nigerians abroad who look after family at home.

**For households in Nigeria (free).** Today's prices for petrol, diesel, kerosene, cooking gas and CNG in every state, shown only as medians of several people's reports; stations and gas shops with queues and problems such as short measure; a cooking gas tracker with refill reminders; and gas refills delivered by sellers RefineryLens has verified, paid on delivery or online.

**For Nigerians abroad.** **Send gas home**: order a refill for family anywhere a verified seller delivers, see the total in naira and in US dollars at a dated exchange rate, pay by card in dollars or naira, and follow the delivery.

**For businesses.** The **trade hub** connects sellers, buyers, delivery partners and refineries: offers and buy requests with matching, private messages, a *Verified* badge after an administrator checks registration and licences, a **gas network** map of LPG and CNG supply and gaps by state, a **price board** of seller medians, **delivery jobs** with quotes and **supply agreements** with a delivery record. Gas sellers receive home gas orders. The **business opportunities** section sizes fuel and gas business models with visible formulas.

**How RefineryLens earns** (all prices set in `.env`):

| Stream | Who pays | Default |
| --- | --- | --- |
| Service fee on gas orders paid online | Households, and Nigerians abroad sending gas home | 3% (min ₦200, max ₦2,500) |
| Commission on delivered gas orders | Sellers: kept from the payout for online orders, settled by card for cash orders | 2.5%, or 1.5% on the Business plan |
| **RefineryLens Plus** (no service fee) | Households, in naira or US dollars | ₦1,500 or $3 per 30 days |
| **Business plan** (featured placement, lower commission) | Verified businesses: naira in Nigeria, US dollars for international suppliers | ₦15,000 or $99 per 30 days |
| **RefineryLens Data** (price index by API) | Traders, banks, researchers, worldwide | From $49 a month |
| Sponsored placements | Brands selling to Nigerian households and businesses | Invoiced in US dollars |

---

## Contents---

## Contents

1. [Quick start](#quick-start)
2. [Demo accounts and data](#demo-accounts-and-data)
3. [What works now and what needs credentials](#what-works-now-and-what-needs-credentials)
4. [Architecture](#architecture)
5. [Screens](#screens)
6. [Administration console](#administration-console)
7. [Content and trust rules](#content-and-trust-rules)
8. [Testing](#testing)
9. [Deploying to production](#deploying-to-production)
10. [Project layout](#project-layout)

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

# 4. Load demo users, businesses, stations and prices
npm run db:seed

# 5. Run
npm run dev                      # http://localhost:3000
```

Production build: `npm run build && npm start`. Optionally run `npm run worker` as a separate process for alert emails, texts, reminders, the price index and open-data refreshes (see [Background jobs](#background-jobs)). `npm run ingest` pulls the [open data feeds](#open-data-feeds) once.

`npm run db:reset` drops and recreates the schema and reseeds. The seed **truncates every table**, so never run it against a database with real users.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run worker` | Background job worker (alert emails and texts, refill reminders, price index, open-data refreshes) |
| `npm run ingest` | Pull every available open-data feed once and print the result |
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Truncate and load demo users, businesses, stations, prices and orders |
| `npm run db:reset` | Reset schema and reseed |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit and integration tests (needs a `refinerylens_test` database) |
| `npm run test:e2e` | Playwright browser tests against a running, seeded app |

---

## Demo accounts and data

All demo accounts use the password **`RefineryLens-demo-2026`**.

| Email | Role | Use it to see |
| --- | --- | --- |
| `tunde@refinerylens.test` | Household | Today's prices, a cylinder with refill history, gas orders |
| `kemi@`, `emeka@`, `halima@`, `joy@refinerylens.test` | Households | Station reports that give Lagos enough people for a median |
| `data@refinerylens.test` | Data customer | RefineryLens Data on the Professional plan, API keys, demo USD payments |
| `admin@refinerylens.test` | Administrator | The administration console: users, verification, moderation, payments and payouts, broadcast, audit log (but **not** business conversations) |
| `seller@refinerylens.test` | Trade hub seller | Ikeja Energy Supplies (demo), verified: LPG and diesel offers, an enquiry from Kano Gas to answer |
| `buyer@refinerylens.test` | Trade hub buyer | Kano Gas Kiosks (demo), verification requested: an LPG buy request and an unread reply |
| `haulier@refinerylens.test` | Trade hub delivery partner | Northern Corridor Haulage (demo), verified: tanker and LPG truck capacity |
| `refinery@refinerylens.test` | Trade hub refinery | Lagoon Coast Refining Co. (fictional demo), verified: polypropylene offer and a crude request |
| `converter@refinerylens.test` | Trade hub buyer | Ogun Resin Converters (demo), unverified: polypropylene and CNG buy requests |
| `surulere@`, `agege@`, `kanobulk@refinerylens.test` | Trade hub sellers | Extra demo sellers that give Lagos and Kano enough price reports for a median |
| `cng@refinerylens.test` | Trade hub seller | Abuja CNG Mobility (demo), verified: CNG stations in Abuja and Lagos and a compression site in Kogi |

Every trade hub business in the seed (`prisma/seed-hub.ts`) is fictional, named "(demo)", flagged as a demo account in the UI, and its prices are labelled as demo figures.

---

## What works now and what needs credentials

### Works out of the box

| Capability | Notes |
| --- | --- |
| Accounts, sign-in, roles | Custom auth: bcrypt (cost 12) password hashes, DB-backed sessions with hashed tokens, httpOnly cookies, rate-limited sign-in |
| Everyday prices, stations, gas tracker, gas orders | Medians only from 3+ people; flags and moderation; refill reminders |
| Gas order money | Service fee, commission, seller ledger, admin payouts; amounts checked against the provider before anything changes |
| Background jobs | PostgreSQL-backed queue (`FOR UPDATE SKIP LOCKED`) |
| In-app alerts | Orders, deliveries, trade hub messages, jobs, supply, data plans, broadcasts |

### Needs credentials or a commercial agreement

| Integration | Status in this release | What is needed |
| --- | --- | --- |
| **S3-compatible object storage** (AWS S3, Cloudflare R2, MinIO) | Implemented and verified against a local S3 server; private, server-side encrypted objects | A bucket and credentials: `STORAGE_DRIVER=s3` plus `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and `S3_ENDPOINT` for non-AWS providers) |
| **Email alert delivery** (SMTP) | Implemented and verified against a local mail server. Users opt in on the alerts page; immediate alerts and daily or weekly digests are emailed by the worker, failed sends are retried | An SMTP account with any provider: `EMAIL_PROVIDER=smtp`, `SMTP_URL`, `EMAIL_FROM`, and `npm run worker` running. Until all are set, the UI says alerts are in-app only |
| **Push notifications** (Google Play and App Store apps) | Implemented for FCM v1 and APNs; tested against mocked services. See `mobile/README.md` | `FCM_SERVICE_ACCOUNT_JSON`; `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID` |
| **Live driver tracking** (gas orders and delivery jobs) | Implemented. The seller or carrier sends its driver a private link; the driver's phone shares GPS from the browser or app while the page is open (no background tracking); the customer or job poster sees a live Leaflet map with distance and a rough arrival time. Positions are deleted 7 days after the trip ends | Nothing to run it. For production traffic, a map tile provider: `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`. The geocoder above improves the drop-off pin |
| **Card and transfer payments** (Plus, Business plan, gas orders paid online, seller commission; Paystack) | Implemented and tested against mocked Paystack responses; nothing changes until Paystack verifies the full amount, through the return verify call or the HMAC-signed webhook. Gas orders can be paid only after the seller confirms the price; paid orders cannot be cancelled in the app (support refunds them) | A Paystack account: `PAYMENT_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY`; prices and fees in `.env.example`; webhook URL `{APP_URL}/api/payments/paystack/webhook` |
| **Send gas home in US dollars** | Implemented: the order total is converted at the latest approved naira rate, rounded up, and charged through Stripe or Paystack USD; tested | The USD setup below and an approved exchange-rate source |
| **SMS and WhatsApp alerts, morning price digest** | Implemented for Termii, Africa's Talking (SMS) and WhatsApp Cloud API (template messages); tested against mocked APIs. Users add a phone and opt in under Account; the worker sends trade hub alerts and one digest a day | One provider's account and keys: `TEXT_PROVIDER` plus `TERMII_*`, `AT_*` or `WHATSAPP_*` (see `.env.example`); WhatsApp needs an approved template with one body parameter |
| **USSD price check** | Implemented for Africa's Talking USSD; tested | An Africa's Talking USSD code pointed at `{APP_URL}/api/ussd?token={USSD_TOKEN}` |
| **CAC registry lookup** for verification | Implemented with Dojah's CAC lookup; results appear in the verification queue, never verify on their own | A Dojah account: `CAC_LOOKUP_PROVIDER=dojah`, `DOJAH_APP_ID`, `DOJAH_SECRET_KEY` |
| **Gas site geocoding** | Implemented with OpenStreetMap Nominatim, one lookup a second in the worker; tested | `GEOCODER=nominatim` and `NOMINATIM_EMAIL`; use your own or a paid Nominatim for heavy use |
| **US dollar revenue: RefineryLens Data** | Implemented: a daily price index by state, product and source (built hourly by the worker, only from 3+ reporters, demo contributions flagged), a REST API (`/api/v1/meta`, `latest`, `prices`, `national`) with hashed API keys, per-day metering and plan history limits, a CSV download, a public page (`/data`) and docs (`/data/docs`), 14-day trials, and plans in USD for foreign customers and naira for Nigerian ones; tested | For USD: `PAYSTACK_USD_ENABLED=true` (after Paystack approves USD with a Zenith USD account) or `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (through a non-Nigerian entity). Naira works with the Paystack keys above |
| **US dollar revenue: sponsored placements** | Implemented: labelled, rel="sponsored" cards on the CNG calculator, stations, today's prices, gas network and hub, targeted by state, rotated by exposure, with views and clicks; sold and invoiced in USD and entered under Administration → Sponsorships; tested | Nothing; sales and invoicing are done by the team |
| **Escrow and trade finance** | Not shipped | A licensed payment or lending partner (see the strategy playbook) |
| **Free open-data feeds** (oil and product prices, the naira exchange rate, Nigerian macro data, global refinery inventory) | Implemented; see [Open data feeds](#open-data-feeds). Keyless feeds are on by default; EIA needs a free key | `EIA_API_KEY` for EIA; nothing for the rest. An administrator approves each source (Health & jobs) before readers see it |
| **Exchange or regulator data feeds** (share prices, filings) | Not connected; no share prices or tickers are shown | Licensed feeds from the relevant exchange or regulator |
| **Paywalled news** | Not ingested; only openly available sources, linked rather than copied | Content licences with publishers |
| **Live plant data** | Not available; the UI states there is no access to live plant systems | Would require a direct agreement with the company |

The admin screen shows the live status of each integration.

### Open data feeds

Free public APIs that give sector-wide and country context. They are cached in PostgreSQL (`MarketSeries`, `MarketObservation`, `RefineryAsset`, with every attempt in `IngestionRun`), refreshed by the worker every `OPEN_DATA_INTERVAL_HOURS` (default 12) or with `npm run ingest`, and never fetched by a page. Each provider creates an **unapproved** `Source` carrying its licence notes; readers only see a feed's data after an administrator approves that source. Every value keeps its publisher, publisher period label, units, retrieval time and request URL (API keys removed).

| Feed | What RefineryLens takes | Scope | Key | Licence and conditions |
| --- | --- | --- | --- | --- |
| [EIA Open Data API](https://www.eia.gov/opendata/) | Brent and WTI spot; US Gulf Coast gasoline, ULSD and jet spot; weekly US refinery utilization; monthly Nigerian crude production | Global market, Nigeria | `EIA_API_KEY` (free) | US government data, public domain; cite EIA |
| [World Bank Indicators API](https://data.worldbank.org/) | Nigeria: official NGN/USD annual average, inflation, GDP, fuel share of imports and exports | Nigeria macro | None | CC BY 4.0; attribute "The World Bank: World Development Indicators" |
| [ExchangeRate-API open access](https://www.exchangerate-api.com/docs/free) | Daily USD/NGN reference rate (not the CBN official rate) | Nigeria macro | None | Attribution link required on pages showing rates; no redistribution of raw rates, so they are never exported |
| [Climate TRACE](https://climatetrace.org/) | Global oil and gas refining assets: name, country, type, capacity (bbl/day), owners, coordinates, estimated CO₂e | Global refinery directory | None | CC BY 4.0, commercial use allowed with attribution; modelled estimates, not disclosures |

RefineryLens also shows an **indicative 3-2-1 crack spread** calculated from the EIA prices, labelled as an estimate with its formula; it is a benchmark, not any refiner's margin.

Checked and deliberately **not** ingested: UN Comtrade (commercial use and redistribution need written UN permission); FRED (its oil series are EIA data, taken at source, and its terms restrict third-party series); the OPEC basket price (no documented API or reuse grant); CBN, NBS, NUPRC and NMDPRA (no documented machine-readable API; upload their reports as documents instead); JODI Oil (bulk files, a candidate for a later importer); price-reporting agencies such as Platts and Argus (paid); AIS ship tracking (free tiers such as aisstream.io are live streams with no history, so they need a stream consumer rather than a periodic feed; left for a later release).

Other features reuse the cached data through `src/server/opendata/index.ts`: `getMarketSignals(keys, actor)` returns the latest value per series key with its source, period, units, retrieval time, attribution and licence, and `listRefineryAssets(filter, actor)` returns the refinery directory. Both apply the same approval rule.

---

## Architecture

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React Server Components, server actions), React 19, TypeScript |
| Styling | Tailwind CSS 3 with a global deep blue and amber palette (`ink` navy neutrals, `brand` deep blue, `amber` accent), a blue-and-amber band and a faint meridian (globe grid) pattern; Inter and Source Serif 4 self-hosted via Fontsource; Lucide icons. Times are shown in West Africa Time (Lagos) |
| Charts | Recharts, always with an accessible table alternative |
| Database | PostgreSQL via Prisma 6; migrations in `prisma/migrations` |
| Auth | Custom, see above. Chosen over an auth library to keep sessions server-side and auditable with no third-party dependency |
| Tests | Vitest (unit and integration against a real Postgres test database), Playwright (browser) |

### Permissions

Role checks live in `src/lib/permissions.ts` and are enforced in server actions and services, not only in the UI. Gas orders are visible only to the customer and the seller. Trade hub conversations are readable only by the user who made the enquiry and the owner of the business it went to; administrators verify, suspend and handle reports (`can.moderateHub`) without access to messages.

### Background jobs

Jobs such as registry lookups and geocoding are queued in PostgreSQL. By default the web process drains the queue straight away (`INLINE_JOBS` unset). In production set `INLINE_JOBS=false` and run `npm run worker` as its own process. The worker also queues an `opendata.ingest` job whenever the open-data feeds are due, and administrators can queue one from the admin screen. The worker also sends alert emails once a minute when email is configured: one message per user, covering every alert that has become visible (digest alerts become visible at 07:00 UTC daily, or Monday for weekly).

---

## Screens

Landing page; sign-in and registration (households land on today's prices, businesses on the trade hub); **Today's prices**; **Stations & gas shops** with reports and flags; **My cooking gas** tracker; **Order gas** and **Send gas home**, with order pages showing progress, a live delivery map and **Pay online** in naira or US dollars; **CNG savings** calculator; **Trade hub** (offers, buy requests and delivery capacity with matching; business profiles; **Gas network**; **Price board**; **Delivery jobs**; **Supply agreements**; **Refineries**; **Hub inbox**; **Home gas orders** with the seller's commission and payouts; **My business**); **Business opportunities**, sizing tools and a private board; **Markets** (oil prices, the naira rate, global refineries); **Alerts**; **Account and plan** with RefineryLens Plus; **RefineryLens Data** pages and API docs; **Administration**.

**Google Play and App Store apps.** Native Android and iPhone apps (Capacitor shells around the live site) live in `android/` and `ios/`, with push notifications for trade alerts, native sharing, app links, in-app account deletion and a public privacy policy. Store listings, privacy answers, screenshots, cloud build workflows and the release steps are in [`mobile/README.md`](mobile/README.md).

**Web and mobile app.** RefineryLens is an installable web app (PWA): on Android and desktop Chrome or Edge an "Install the RefineryLens app" button appears in the menu; on iPhone and iPad use Safari's Share, then Add to Home Screen. It opens full screen on the trade hub, with shortcuts to prices, the gas network, jobs and the inbox. On phones a bottom tab bar keeps Hub, Prices, Gas map, Jobs and Inbox one tap away. The service worker (`public/sw.js`) always loads pages from the network; offline, it shows the last copy of a page opened on that device, or an offline page. Private pages (inbox, settings, admin, orders) are never stored, and signing out clears stored pages. Installing needs HTTPS in production.

Colour system: Atlantic navy (`#0B1530`, the `ink` and `navy` scales in `tailwind.config.ts`) carries structure, deep blue (`brand`, `#1A47D1`) marks actions, links and verified businesses, amber (`#F5A524`) highlights prices, Plus and calls to action on dark backgrounds, and white is the page. A thin blue-and-amber band and the amber dot on the lens mark are the brand's signatures.

All screens are responsive from phone to desktop widths, keyboard navigable with visible focus and a skip link, and use semantic headings and labels.

---

## Administration console

Administrators open **Administration** (`/admin`). Every section shares one navigation, grouped by area, with a count on any section that has work waiting. Every tool checks the administrator role on the server (`src/server/admin/guard.ts`), and every change is written to the audit log. Administrators cannot read business conversations.

| Area | Section | What it does |
| --- | --- | --- |
| Console | Overview | Key numbers, 14-day charts of new accounts, gas orders and station reports, where people are, and a **Needs attention** list linking to each queue |
| People | Users | Search by name, email or phone; filter by kind, role, plan, state and reporting block. A person's page changes role, plan and start page, stops them reporting, signs them out on every device, and shows their orders, reports, payments and audit history |
| Trade hub | Verification & reports | Verify or return businesses (with the CAC registry check), handle reports, suspend and reinstate |
| | Businesses | Directory by status, role, state, home delivery and plan; suspend, reinstate, grant 30 days of the Business plan |
| | Listings | Live, expired and closed listings; take one down with a reason the business is told |
| | Delivery jobs | Jobs by status, quotes, tracking state and stale awards; cancel with a reason |
| Everyday | Flagged content | Station reports and places people flagged; hide, restore, dismiss; stop an account reporting |
| | Stations & shops | Edit details, hide and show, and merge duplicates so their reports count together |
| | Price watch | Public medians by state and product, and the week's reports 30% or more from their state median, with a hide button |
| | Gas orders | All orders with counts by status; stuck orders (no answer in 2 hours, or open over a day); cancel with a reason both sides are told |
| | Live trips | Drivers sharing location, silent trips, end a trip left running (no exact positions shown) |
| Money | Payments & plans | Service fees and commission earned, commission owed by sellers, **payouts due to sellers** for orders paid online (mark paid out), payments in naira and US dollars with filters, revenue by month per currency (gas order pass-through left out), Business plans ending within 14 days |
| | Data customers | Data accounts, recurring revenue in USD and naira at list price, set Enterprise or invoiced terms, rebuild the price index |
| | Sponsorships | Add labelled sponsorships with placements, states, dates and USD price; pause, resume; views, clicks and click rate |
| Communication | Broadcast | Count a group (everyone, households, business accounts, sellers, buyers, delivery partners, refineries, home-delivery sellers; optionally one state), then send an in-app alert and push notification. The count is confirmed when sending; links must stay inside RefineryLens; never sent by SMS |
| System | Health & jobs | Integrations by group, background job counts, failed jobs with retry, open data feeds |
| | Audit log | Filter by action, person, entity, ID and date |
| | Exports | CSV downloads of users, businesses, stations, public and seller price reports, gas orders and payments, without addresses, phone numbers or who reported what; spreadsheet formulas are neutralised and each download is logged |

---

## Content and trust rules

These are enforced in code and covered by tests:

- A public price appears only once at least three different people (or sellers) have reported it, as a median; one report never shows on its own.
- Demo data is labelled as demo wherever it appears, including dollar amounts at a demo exchange rate.
- Gas orders go only to verified sellers; the customer's address and phone go only to that seller.
- Online payment is possible only after the seller confirms the price; the seller is told not to collect cash; money changes nothing until the provider confirms the full amount.
- Fees and commission are shown before anyone pays, on the landing page, the order page and the seller's orders page.
- Market data appears only from sources an administrator has approved, with attribution.

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

They cover prices and medians, moderation, gas orders and tracking, online payments, fees, commission, payouts and Plus, the trade hub, the data API and USD checkout, alerts, email and text delivery, S3 storage, permissions, and no horizontal scrolling on mobile.

---

## Deploying to production

1. Provision PostgreSQL and set `DATABASE_URL`, a fresh `SESSION_SECRET` and `APP_URL`.
2. `npm ci && npm run db:migrate && npm run build`.
3. Do **not** run the seed. Create the first administrator by registering and then promoting the account in the database (`UPDATE "User" SET role='ADMIN' WHERE email='…'`).
4. Run `npm start` behind HTTPS, and `npm run worker` as a second process with `INLINE_JOBS=false`.
6. To email alerts, set `EMAIL_PROVIDER=smtp`, `SMTP_URL` and `EMAIL_FROM`.
6. Before approving an open-data source under Health & jobs, confirm its licence.
7. Pay sellers for online orders from Administration → Payments, and mark each one paid out.

---

## Project layout

```
prisma/
  schema.prisma          data model
  migrations/            SQL migrations
  seed.ts                demo users and data (hub, everyday, revenue, exchange rate)
scripts/worker.ts        background job worker
scripts/ingest.ts        one-off open-data refresh
src/
  app/                   routes: (auth), (app) screens, actions/, api/
  components/            UI components
  lib/                   permissions, money rules, labels, formatting, plans
  server/                auth, storage (local, S3), email, jobs, integrations, fx
    everyday/            prices, stations, gas orders, cylinders, money (payments, ledger, payouts)
    hub/                 trade hub
    services/            alerts, users, account, market
    opendata/            open-data catalogue, provider adapters, ingestion, read API
tests/
  unit/  integration/    Vitest
  e2e/                   Playwright
```
