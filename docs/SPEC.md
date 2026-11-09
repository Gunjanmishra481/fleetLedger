# FleetLedger — Car-Carrier Trip Management App: Design & Claude Code Build Plan

Nov 9, 2026 · @gunjan

FleetLedger replaces the monthly loading sheet with a web app where one trip = one record, costs and profit calculate themselves, and every driver, trailer, route and month gets its own summary. This plan is written so it can be pasted into Claude Code phase by phase.

## 1. What the SEP-26 sheet tells us

September 2026 holds **224 trips** across **18 trailers** and about **15 drivers**, moving **1,467 cars** for **₹63.20 lakh revenue** against **₹32.52 lakh direct cost** (₹30.67 lakh profit, 48.5% margin before salary, maintenance and cash expenses, whose tabs are empty).

### Columns → app fields

| Sheet column | Meaning (as read from the data) | App field | Entered or computed |
| --- | --- | --- | --- |
| F | Running serial no. | `serial_no` | Auto |
| DATE | Loading date | `trip_date` | Entered (defaults to today) |
| TRAILER NO | Vehicle registration (e.g. NL01AL1658) | `vehicle_id` → Vehicles master | Picked from list |
| DRIVER | Driver name | `driver_id` → Drivers master | Auto-suggested from the trailer's usual driver |
| LR NO | Lorry receipt no. (1238–1454, some with -A suffix) | `lr_no` | Auto-next, editable, must be unique |
| FROM | Loading point (OCPL Detroj, Mittal (Tata), JKTI / APL / TCI Chharodi, APL Detroj) | `origin_id` → Locations | Picked |
| DESTINATION | Drop city, sometimes two ("RAJKOT + JUNAGARH") | `trip_stops[]` → Locations | Picked, multi-select |
| NO CAR | Cars loaded (5–8) | `cars_count` | Entered |
| DIESEL | Litres issued | `diesel_litres` | Pre-filled from route standard |
| Rate/ltr | Diesel price (₹98.36 all month) | `diesel_rate` | Pre-filled from current rate |
| Diesel Amount | = DIESEL × Rate | `diesel_amount` | Computed |
| POD | POD charge (₹300 flat) | `pod_charge` | Pre-filled |
| Maint | Maintenance on the trip (used twice, both 0) | `maintenance` | Entered |
| TRIP | Driver trip allowance (₹500–1,700 by route) | `driver_allowance` | Pre-filled from route |
| Total Cost | = Diesel + POD + Maint + Trip | `total_cost` | Computed |
| Trip Revenue | Freight billed for the trip | `freight_amount` | Pre-filled from rate card |
| Profit/Loss | = Revenue − Total Cost | `profit` | Computed |
| REMARK | "INVOICE DONE" on 218 rows | `billing_status` | Status dropdown |
| DEALER | "MAHESH" on 6 rows: the client dealer | `dealer_id` | Picked from Dealers list (optional) |

Sheet1 is a hand-built pivot of trailer × destination; the CASH EXP and SALARY tabs exist but are blank, which signals two modules the business already wants.

### Business rules hidden in the data

- **Freight is a fixed rate per route, not per car.** OCPL Detroj → Ahmedabad billed ₹15,871 on all 52 trips whether 6, 7 or 8 cars; Mittal (Tata) → Pipavav Port billed ₹44,272 on all 30. The app needs a **rate card** keyed on loading point + destination.
- **Diesel and allowance are route standards too.** OCPL → Rajkot is 185–190 L and ₹1,700; OCPL → Ahmedabad is 60–80 L and ₹1,000. Pre-fill these and flag big deviations.
- **Short runs repeat in a day.** 29 trailer-days had two trips on the same date, mostly Ahmedabad shuttles.
- **Multi-drop trips exist** ("GANDHIDHAM + BHUJ", "SURAT + VADODRA"), so destination is a list, not one city.

### Data-quality problems the app must prevent

- 31 trips have **no driver** recorded.
- One driver is spelled two ways: JAVAHIR (21) and JAWAHIR (3).
- Same place, different text: "OCPL(DETROJ)" vs "OCPL (DETROJ)", "RAJKOT + JUNAGARH" vs "RAJKOT+JUNAGARH", "VADODARA" vs "VADODRA".
- **LR 1384 is used twice** (two different trailers on 18 Sep) and serial 205 appears twice.
- 6 trips (incl. PB10GK0807, not one of the 17 regular trailers) carry full revenue but zero cost, so they count as 100% profit and inflate the margin.

Masters with dropdowns, a unique LR rule and required fields remove all five.

**Confirmed with the owner:** DEALER is the client dealer for the trip; TRIP is the driver's trip allowance; salary is not split across trailers. Trips are entered by a person, so the app guides entry rather than auto-correcting it.

## 2. Similar products and what to borrow

Indian transport ERPs centre everything on one trip record that flows into billing and ledgers; car-hauler TMSs add per-car tracking and e-POD. FleetLedger takes the trip-record core from the first group and the per-car idea from the second, without GPS hardware or subscription cost.

| Product | Who it's for | Idea worth borrowing | Skip for v1 |
| --- | --- | --- | --- |
| [Fleetx Transporter ERP](https://www.fleetx.io/solutions/by-industries/transportation-and-logistics) | Indian fleets, 10–1,000+ trucks | Trip settlement module; driver app for expenses; e-POD upload sent to stakeholders | Telematics, driver-behaviour scoring |
| [Fyond transport module](https://saas.goclixy.com/blog/best-transport-fleet-software-india-buyers-guide) | Small Indian operators | Driver advance/expense ledger with a running balance both sides see; trip-wise advances | Full accounting suite |
| [TransportBook](https://appgoblin.info/apps/in.transportbook.app) | Indian truck owners | Truck khata, trip P&L, document expiry, digital LR/bilty | Vahan lookups |
| [Online LR](https://apps.apple.com/in/app/onlinelr/id1549819077) | Indian transporters | PDF LR, memo, cash voucher, payment slip from one entry | GST invoicing (phase 3) |
| [TMS Mitra](https://www.sagarinfotech.com/transport-management-software/fleet-management-software) | Indian fleet owners | Reports: vehicle utilisation, trip profitability, driver expense patterns, pending billing | Branch hierarchy |
| [Ship.Cars SmartHaul](https://ship.cars/smarthaul-tms) / [Driver ePOD](https://ship.cars/driver-epod) | US car haulers | Trip builder for multi-stop loads; paperless pick-up and delivery | Load board, capacity matching |
| [Tracx TMS](https://www.tracxtms.com/specialized-carrier-software) | Specialised carriers | Each car on a carrier is its own record (VIN, condition, delivery status) | VIN barcode scanning (phase 3 option) |

**Gap FleetLedger fills:** none of these ship with a car-carrier rate card per loading point → dealer city, route-standard diesel checks, or a one-screen entry tuned to how this office already works. That fit, plus zero per-vehicle fees, is the reason to build rather than buy.

## 3. Product scope

Version 1 is an office web app for the person who keeps the sheet today; it must make entering a trip faster than typing an Excel row, then give the owner answers the sheet can't.

### Users and roles

| Role | Does | Sees |
| --- | --- | --- |
| Admin (owner) | Manages users, rate card, diesel rate, month close | Everything, incl. profit |
| Operations (data entry) | Enters and edits trips, drivers, advances | Trips, masters, driver/trailer summaries; profit hidden by setting |
| Accounts | Billing status, invoices, payments, expenses, salary | Finance screens and reports |
| Viewer (optional) | Read-only for a partner or auditor | Dashboards and reports |

### Modules

1. **Trips** — the core register replacing SEP-26: entry form, fast grid entry, list with filters, trip detail.
2. **Masters** — Vehicles (trailers), Drivers, Locations (loading points and dealer cities), Consignors (OCPL, Mittal/Tata, JKTI, APL, TCI), Rate card, Diesel rate history.
3. **Driver ledger** — allowance earned per trip, advances paid, salary, deductions, running balance.
4. **Expenses** — the empty CASH EXP tab: cash spends tagged to a trailer, driver or trip (toll, repair, tyre, loading/unloading).
5. **Salary** — the empty SALARY tab: monthly salary per driver/staff, linked to the driver ledger.
6. **Billing** — replaces the REMARK column: Unbilled → Invoiced → Paid, invoice batches per consignor per month.
7. **Reports and dashboard** — monthly KPIs, driver, trailer, route and consignor summaries, Excel export.

### Smart features

| Feature | What it does | Phase |
| --- | --- | --- |
| Route auto-fill | Pick From + Destination → freight, standard diesel litres and driver allowance fill in from the rate card; diesel rate from the current price | 1 |
| Driver suggestion | Pick a trailer → its usual driver (most trips in last 30 days) pre-selects | 1 |
| Auto LR number | Next LR pre-filled; duplicates blocked; "-A" split loads allowed via a split button | 1 |
| Grid entry mode | Spreadsheet-style keyboard grid for entering a whole day's trips; Enter moves down, Tab across | 1 |
| Duplicate trip | Copy yesterday's trip for the same trailer and change only what differs | 1 |
| Excel import | Load SEP-26 (and earlier months) with a mapping and clean-up preview, so history is in from day one | 1 |
| Anomaly flags | Warn on: diesel >10% above route standard, zero-cost trip, missing driver, duplicate LR, freight different from rate card, trailer with 3+ trips a day | 2 |
| Driver summary | Per driver per month: trips, cars, routes, trailers driven, allowance earned, advances, balance due, profit generated, active-day calendar | 2 |
| Trailer summary | Per trailer: trips, active days (utilisation), revenue, cost, profit, ₹ profit/trip, diesel litres vs route standard, drivers who ran it, maintenance and expense log | 2 |
| Route profitability | Per From → Destination: trips, average diesel, margin; spots lanes where diesel creeps up | 2 |
| Idle trailer alert | Trailers with no trip for N days (e.g. NL01N3653 ran 3 trips in September) | 2 |
| Document expiry | Insurance, fitness, permit, PUC, tax and driver licence dates; reminders 30/15/7 days before | 2 |
| Billing aging | Unbilled and unpaid trips by consignor, days outstanding | 3 |
| Invoice PDF + LR PDF | Printable LR and consignor invoice from trip data | 3 |
| Month close | Lock a month after billing; edits after close need Admin and are logged | 3 |
| Ask in plain words | Optional: "How much diesel did Dalbir use in September?" answered from the database via an LLM API, read-only | 4 |
| POD photo capture | Mobile upload of POD/LR photo against the trip | 4 |

Out of scope for v1: GPS tracking, driver mobile app, GST e-invoicing, multi-company.

## 4. Data model

Eleven tables: five masters, the trip with its stops, and four money ledgers. Money is stored as integer paise and litres as decimals, so totals never drift; computed columns (diesel amount, total cost, profit) are derived in one service function, never typed.

| Table | Key fields | Notes |
| --- | --- | --- |
| `Vehicle` | reg\_no (unique), type, owner\_type (OWN / MARKET), usual\_driver\_id, insurance\_exp, fitness\_exp, permit\_exp, puc\_exp, tax\_exp, active | 17 own trailers + market vehicles like PB10GK0807 |
| `Driver` | name, aliases\[\], phone, licence\_no, licence\_exp, joined\_on, monthly\_salary, active | aliases merge JAVAHIR / JAWAHIR |
| `Location` | name (unique), kind (LOADING\_POINT / DESTINATION), district | "OCPL (DETROJ)" and "OCPL(DETROJ)" become one row |
| `Consignor` | name, gstin, billing\_address, default\_origin\_id | OCPL, Mittal (Tata), JKTI, APL, TCI |
| `RateCard` | origin\_id, destination\_key, freight, std\_diesel\_l, driver\_allowance, pod\_charge, effective\_from, effective\_to | destination\_key = sorted stop ids, so multi-drops have their own rate |
| `DieselRate` | rate\_per\_l, effective\_from | ₹98.36 from Sept 2026 |
| `Trip` | serial\_no, trip\_date, lr\_no (unique), vehicle\_id, driver\_id, origin\_id, consignor\_id, cars\_count, diesel\_l, diesel\_rate, pod\_charge, maintenance, driver\_allowance, freight, dealer\_id, billing\_status, invoice\_id, notes, created\_by, month\_key | costs and profit computed |
| `TripStop` | trip\_id, location\_id, seq | 1–3 stops per trip |
| `DriverLedger` | driver\_id, date, kind (ALLOWANCE / ADVANCE / SALARY / DEDUCTION / PAYMENT), amount, trip\_id?, note | ALLOWANCE rows auto-created from trips |
| `Expense` | date, category, amount, vehicle\_id?, driver\_id?, trip\_id?, paid\_by, note | the CASH EXP tab |
| `Invoice` | consignor\_id, number, period, total, status, issued\_on, paid\_on | groups trips for billing |

Plus `User` (role), Dealer master (client name, city, phone; picked on the trip), `AuditLog` (who changed which field, old → new) and `MonthLock`.

### Formulas (single source of truth)

```
diesel_amount = diesel_l × diesel_rate
total_cost    = diesel_amount + pod_charge + maintenance + driver_allowance
profit        = freight − total_cost
trailer_net   = Σ trip profit − Σ trailer expenses
```

The first three reproduce the sheet's Diesel Amount, Total Cost and Profit/Loss exactly; the import test (section 7) checks this against all 224 September rows.

## 5. Screens and UX

The design goal is "faster than Excel": a trip should take under 20 seconds to enter with keyboard only, and every number on a summary should click through to the trips behind it.

### Design rules

- Left sidebar: Dashboard, Trips, Drivers, Trailers, Routes, Billing, Expenses, Salary, Reports, Masters, Settings. A month picker sits in the top bar and scopes every screen.
- Indian formats everywhere: ₹1,23,456 and ₹63.20 L, dates as 01-Sep-26, registration numbers forced to upper case.
- Dense tables (36 px rows), sticky headers, right-aligned numbers, profit in green / loss in red, warning chips in amber.
- Keyboard: `N` new trip, `G` grid mode, `/` search, `Ctrl+Enter` save, `Ctrl+D` duplicate last row.
- Works on a 10-inch tablet; mobile layout for summaries only in v1.

### Screens

1. **Dashboard** — KPI tiles (trips, cars, revenue, cost, profit, margin, diesel litres, unbilled amount) vs last month; daily trips bar chart; top 5 and bottom 5 trailers by profit; idle trailers; alerts list (anomalies, expiring documents).
2. **Trips list** — the SEP-26 sheet reborn: same column order so the clerk feels at home, plus filters (date range, trailer, driver, from, destination, billing status, dealer, flagged only), totals row at the bottom, column chooser, export to Excel in the original layout.
3. **New / edit trip (form)** — three blocks top to bottom: *Who & where* (date, LR, trailer → driver auto-fills, from, destinations multi-select, cars); *Costs* (diesel litres with the route standard shown beside it, rate, POD, maintenance, allowance); *Money* (freight from rate card, live total cost and profit card on the right). Inline warnings, never blocking except duplicate LR.
4. **Grid entry** — an editable spreadsheet for a whole day: type-ahead cells for trailer, driver and places, auto-fill on leaving the destination cell, red cell borders for errors, "Save all".
5. **Trip detail** — all fields, cost breakdown, stops, billing status, linked expenses, audit history.
6. **Driver summary** — header with name, phone, licence expiry, balance due; KPI tiles for the month; calendar heatmap of trip days; tables of trips, trailers driven and routes; ledger tab with advances and payments; "Settle month" button.
7. **Trailer summary** — header with reg no., owner type, documents with expiry badges; KPI tiles (trips, active days %, revenue, profit, ₹/trip, diesel L vs standard); 6-month profit trend; trips table; destinations breakdown (replaces the Sheet1 pivot); drivers who ran it; expenses and maintenance log.
8. **Routes** — one row per From → Destination with trips, freight, average diesel vs standard, margin; click to see the trips.
9. **Billing** — unbilled trips grouped by consignor, "Create invoice" from a selection, invoice list with status and days outstanding.
10. **Expenses and Salary** — simple registers with category, linked trailer/driver, monthly totals.
11. **Masters** — CRUD pages for vehicles, drivers (with alias merge), locations (with merge), consignors, rate card (with effective dates), diesel price.
12. **Import** — upload .xlsx → column mapping → clean-up preview (unknown names to map or create, duplicates, zero-cost rows) → commit.

To see these as mockups before building, a design pass on the Trips list, Trip form and Trailer summary is the right first step.

## 6. Tech stack and architecture

One full-stack TypeScript app on a managed Postgres keeps hosting near ₹0 at this size (about 250 trips a month) and plays to a React/TypeScript skill set.

&#91;embedded content: FleetLedger architecture · one app, one database\]

Every screen reads and writes through server actions; only the trip service computes money, so the grid, the form and the importer can never disagree.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript (strict) | UI and server in one repo; server actions remove a separate API |
| UI | Tailwind CSS + shadcn/ui, lucide icons | Clean, dense admin look quickly |
| Tables and grid | TanStack Table + an editable grid (react-data-grid or AG Grid Community) | Filters, totals, keyboard entry |
| Forms | react-hook-form + zod | Same zod schema validates client and server |
| Charts | Recharts | KPI trends, calendars, bars |
| Database | PostgreSQL on Neon or Supabase (free tier) | Relational, reliable, SQL for reports |
| ORM | Prisma | Typed queries, migrations, seed scripts |
| Auth | Auth.js (credentials) with roles | Few office users, no outside sign-in needed |
| Excel | exceljs | Import SEP-26, export in the same layout |
| PDF (phase 3) | @react-pdf/renderer | LR and invoice printouts |
| Tests | Vitest (logic), Playwright (flows) | Money maths must be proven |
| Hosting | Vercel + Neon, daily DB backup | Push-to-deploy |

### Folder layout

```
fleetledger/
  prisma/schema.prisma, seed.ts
  src/app/(app)/dashboard, trips, trips/new, trips/[id], drivers/[id],
             trailers/[id], routes, billing, expenses, salary, masters/*, import
  src/server/services/trip.ts      # compute(), autofill(), flags()
  src/server/services/summary.ts   # driver, trailer, route, month queries
  src/server/services/import.ts    # xlsx → preview → commit
  src/server/actions/*.ts          # server actions per module
  src/lib/money.ts, format.ts      # paise maths, ₹ and date formatting
  src/components/ui, grid, charts, kpi
  tests/unit, tests/e2e, tests/fixtures/SEP_LOADING_DETAILS-26.xlsx
  CLAUDE.md                        # rules for Claude Code (section 7)
```

## 7. Claude Code build plan

Build in six phases, each one prompt (or a few) to Claude Code, each ending in something the office can use and a checklist you verify before moving on. For a working version fast, use the fast track below: one session, few permission prompts, an MVP covering phases 0–3. Then add phases 4–6 when needed.

### Fast track: working MVP in one session

The MVP gets trip entry, the trip register, September import, and driver, trailer and dashboard summaries running locally in one Claude Code session, with almost no permission prompts.

**1. Start Claude Code in auto mode.** In auto mode Claude runs without routine prompts, and a background classifier checks shell commands and network requests before they run ([docs](https://code.claude.com/docs/en/permission-modes)). Recent versions start in auto mode by default; to be sure, launch with:

```
cd fleetledger
claude --permission-mode auto
```

If auto mode isn't available on your plan or model, use `claude --permission-mode acceptEdits` (file edits and mkdir/mv/cp run without asking) plus the allow rules in step 2, so the remaining commands don't prompt either. Use `--dangerously-skip-permissions` only inside a container or VM: the docs reserve it for isolated environments.

**2. Pre-approve the build commands.** Create `.claude/settings.json` in the repo:

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(git init)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git status)",
      "Bash(git diff *)"
    ],
    "ask": ["Bash(git push *)"]
  }
}
```

Accept the workspace-trust dialog once; Claude Code only applies project allow rules after that.

**3. Cut setup for the MVP.** Use SQLite through Prisma (a file database, no account needed) and one admin login from `.env`. Move to Postgres for deployment by changing the Prisma provider. With SQLite, store enum-like fields as strings and driver aliases in a small `DriverAlias` table.

**4. Add these lines to the bottom of CLAUDE.md:**

```markdown
## Speed rules (MVP)
- Work autonomously. Do not stop to ask questions; make a reasonable choice and log it in DECISIONS.md.
- Do not ask for confirmation between steps. Continue until the whole task is done.
- Prefer working software over polish. No extra libraries, no refactors beyond the task.
- Write tests only for money maths and the September import; skip Playwright for the MVP.
- After each milestone: pnpm test && pnpm build, fix errors, git commit, keep going.
```

**5. Paste this single prompt:**

```
Read CLAUDE.md and docs/SPEC.md. Build the FleetLedger MVP end to end without stopping to ask me
anything. Use SQLite via Prisma for now. Milestones, committing after each:
1. Scaffold Next.js 15 + TypeScript + Tailwind + shadcn/ui + Prisma + Vitest; app shell with sidebar
   (Dashboard, Trips, Drivers, Trailers, Routes, Import, Masters), month picker (?m=2026-09),
   single admin login from .env.
2. Prisma schema from SPEC section 4 (Vehicle, Driver, DriverAlias, Location, Dealer, RateCard,
   DieselRate, Trip, TripStop, AuditLog). src/server/services/trip.ts compute() and autofill(),
   money as integer paise, with Vitest tests.
3. Importer for tests/fixtures/SEP_LOADING_DETAILS-26.xlsx (sheet SEP-26): normalise names, merge
   JAVAHIR/JAWAHIR, split destinations on "+", build the rate card, flag duplicates and missing
   drivers, import everything. Test: 224 trips, 1,467 cars, revenue 6319590, cost 3252179.
   Also add a seed script that runs the import so `pnpm db:seed` loads September.
4. Trips: list in SEP-26 column order with filters and totals, Excel export, new/edit form with
   autofill (trailer -> driver; from + destination -> freight, diesel, allowance, POD, rate),
   auto-next LR, unique LR check, live cost/profit.
5. Summaries: dashboard KPIs + daily trips chart, driver page, trailer page (incl. destination
   breakdown), routes page, simple anomaly flags.
Finish with pnpm build passing and a README section "Run locally". Then summarise what was built
and list anything in DECISIONS.md I should check.
```

While it runs you only need to answer the occasional prompt the classifier sends back (for example a network request it can't place). When it finishes: `pnpm dev`, open localhost:3000, and enter one real trip.

The phase-by-phase plan below stays as the reference for what each part should do, and for the later money, billing and deployment work.

### Before you start

- Create an empty repo `fleetledger`, a Neon (or Supabase) Postgres database, and put `DATABASE_URL` in `.env`.
- Copy `SEP_LOADING_DETAILS-26.xlsx` into `tests/fixtures/`.
- Paste this doc's sections 1, 3, 4 and 5 into `docs/SPEC.md` so Claude Code can read them.
- Create `CLAUDE.md` with the rules below; Claude Code reads it every session.

```markdown
# FleetLedger — rules for Claude Code

Product: trip register + summaries for a car-carrier fleet in Gujarat. Spec: docs/SPEC.md.
Stack: Next.js 15 App Router, TypeScript strict, Tailwind + shadcn/ui, Prisma + Postgres,
Auth.js credentials, zod, TanStack Table, Recharts, exceljs, Vitest, Playwright.

Rules
- Money is integer paise (Int). Never use floats for money. Format with src/lib/format.ts (en-IN, ₹, lakh).
- All cost/profit maths lives ONLY in src/server/services/trip.ts compute(). UI and importer call it.
- Every mutation is a server action that: checks role, validates with the shared zod schema,
  writes an AuditLog row, and refuses edits to a locked month unless role = ADMIN.
- Names (drivers, locations) are always foreign keys to masters, never free text.
- LR number is unique. Registration numbers are stored upper-case without spaces.
- Dates are stored as DATE (no time). Display as dd-MMM-yy.
- Write Vitest tests for every service function before wiring UI. Run `pnpm test` and `pnpm lint` before saying a task is done.
- Keep components small; put data fetching in server components, interactivity in client components.
- Do not add libraries outside the stack without asking.
```

### Phase 0 — Scaffold

```
Read CLAUDE.md and docs/SPEC.md. Scaffold the Next.js 15 app with pnpm, TypeScript strict,
Tailwind, shadcn/ui, Prisma, Auth.js (credentials, bcrypt), Vitest and Playwright.
Build the app shell: left sidebar (Dashboard, Trips, Drivers, Trailers, Routes, Billing,
Expenses, Salary, Reports, Masters, Settings), top bar with a month picker stored in the URL
(?m=2026-09), login page, roles ADMIN / OPS / ACCOUNTS / VIEWER enforced in middleware.
Add src/lib/format.ts (₹ en-IN, lakh, dd-MMM-yy) and src/lib/money.ts (paise helpers) with tests.
Seed one admin user from env vars.
```

- [ ] `pnpm dev` runs, login works, sidebar routes render placeholder pages
- [ ] format tests pass: 6319590 → "₹63,19,590" and "₹63.20 L"

### Phase 1 — Data model and September import

```
Implement the Prisma schema from SPEC section 4 (Vehicle, Driver with aliases, Location,
Consignor, RateCard, DieselRate, Trip, TripStop, DriverLedger, Expense, Invoice, User,
AuditLog, MonthLock). Write src/server/services/trip.ts with compute() and autofill()
(rate card lookup by origin + sorted destination stops, current diesel rate, usual driver).
Write src/server/services/import.ts that reads an .xlsx sheet laid out like SEP-26:
- normalise names (trim, collapse spaces, upper-case; "OCPL (DETROJ)" = "OCPL(DETROJ)")
- split DESTINATION on "+" into ordered stops
- map unknown drivers/locations via a preview step (create, or merge as alias)
- report issues: missing driver, duplicate LR, duplicate serial, zero-cost rows
- build the rate card from the most common freight / diesel / allowance per route
Build the /import page: upload → mapping → issues preview → commit.
Add a Vitest test that imports tests/fixtures/SEP_LOADING_DETAILS-26.xlsx into a test DB.
```

- [ ] Test asserts 224 trips, 1,467 cars, 29,525 L diesel
- [ ] Revenue ₹63,19,590, cost ₹32,52,179, profit ₹30,67,411 (matches the sheet's formulas)
- [ ] JAVAHIR/JAWAHIR become one driver; 7 loading-point spellings become 6 locations
- [ ] Preview lists 31 missing drivers and LR 1384 as a duplicate

### Phase 2 — Trip entry and the trip register

```
Build the Trips module from SPEC section 5, screens 2–5:
- /trips list with the SEP-26 column order, filters, totals row, column chooser, Excel export
  in the original layout, "flagged only" toggle
- /trips/new form: trailer selection auto-fills usual driver; origin + destinations auto-fill
  freight, diesel litres, allowance, POD, diesel rate from autofill(); LR auto-next;
  live cost/profit card; route-standard diesel shown beside the input; duplicate LR blocks save
- /trips/grid: editable day grid with type-ahead cells, autofill on leaving destination,
  per-cell errors, Save all in one transaction
- /trips/[id] detail with audit history; "Duplicate" and "Split LR (-A)" actions
- keyboard shortcuts N, G, /, Ctrl+Enter, Ctrl+D
Every save creates the matching DriverLedger ALLOWANCE row.
Playwright test: enter 3 trips in grid mode and confirm totals.
```

- [ ] A typical OCPL → Ahmedabad trip saves with only trailer, from, destination, cars typed
- [ ] Editing a trip updates its ledger row and writes an audit entry
- [ ] Excel export of September opens in Excel with the same columns as SEP-26

### Phase 3 — Summaries, dashboard and smart flags

```
Write src/server/services/summary.ts with SQL-backed functions for month KPIs, driver summary,
trailer summary, route summary, idle trailers, and flags(trip) (diesel >10% over route standard,
zero cost, no driver, freight ≠ rate card, 3+ trips same trailer same day). Unit-test each
against the September fixture. Build /dashboard, /drivers/[id], /trailers/[id], /routes per
SPEC section 5 screens 1, 6, 7, 8. Every number links to the filtered trips list.
```

- [ ] NL01AL1658 shows 25 trips and NL01N3654 25 trips for September
- [ ] Dalbir shows 24 trips, all on NL01N3650
- [ ] OCPL → Ahmedabad route shows 52 trips at ₹15,871 each
- [ ] Trailer destination breakdown matches the Sheet1 pivot

### Phase 4 — Money: ledger, expenses, salary, billing

```
Build driver ledger (advances, payments, salary, deductions, running balance, "Settle month"),
/expenses and /salary registers linked to trailer/driver/trip, and /billing: unbilled trips by
consignor, create invoice from selection, statuses Unbilled → Invoiced → Paid, days outstanding.
Add month close (MonthLock) and LR + invoice PDFs with @react-pdf/renderer.
Trailer summary now shows net profit after trailer-linked expenses; salary stays a company-level cost and is not split per trailer.
```

- [ ] A driver's balance = allowances + salary − advances − payments, checked by test
- [ ] Locked month rejects edits from OPS; ADMIN edit is logged

### Phase 5 — Masters polish, reminders and deploy

```
Finish masters CRUD with merge tools for drivers and locations, rate-card versions with
effective dates, diesel price history. Add document expiry fields and a daily reminder list on
the dashboard (30/15/7 days). Add a nightly DB backup note in README, seed script for a demo
month, and deploy to Vercel + Neon. Write README with setup and a one-page user guide.
```

- [ ] Changing diesel price from a date affects only new trips
- [ ] Production URL works on a tablet; the clerk enters one real day of trips

### Phase 6 (optional) — POD photos and plain-language questions

Add POD/LR photo upload to trips (Supabase Storage or S3), and an "Ask" box that turns a question into a read-only, parameterised query over the summary services through an LLM API. Keep it behind an ADMIN flag and log every question.

### Working tips for Claude Code

- One phase per session; start with "Read CLAUDE.md and docs/SPEC.md, then propose a plan for phase N".
- Ask for tests first on anything that touches money, then the UI.
- After each phase: `pnpm test && pnpm lint && pnpm build`, click through the checklist, commit.
- Whenever a business rule changes, update SPEC.md before the phase that needs it.

## 8. Testing, rollout and sources

The September file is the acceptance test: if the app reproduces its totals exactly and shows the same pivot, the office can stop using Excel.

- **Unit tests (Vitest):** compute(), autofill(), flags(), every summary function, money formatting, importer normalisation.
- **End-to-end (Playwright):** login per role, enter trips by form and grid, edit a locked month, export Excel.
- **Parallel run:** for the first two weeks of rollout, keep the Excel sheet too and compare the month-to-date totals daily; switch off Excel once three days in a row match.
- **Backups:** Neon point-in-time restore plus a weekly Excel export of all trips kept by the owner.
- **Training:** a 15-minute walkthrough of grid entry for the data-entry person; the shortcuts list sits in the app's help menu.

### Sources

- [Fleetx — Transportation & Logistics](https://www.fleetx.io/solutions/by-industries/transportation-and-logistics)
- [Fyond buyer's guide to transport software in India](https://saas.goclixy.com/blog/best-transport-fleet-software-india-buyers-guide)
- [TransportBook app listing](https://appgoblin.info/apps/in.transportbook.app)
- [Online LR on the App Store](https://apps.apple.com/in/app/onlinelr/id1549819077)
- [TMS Mitra fleet management](https://www.sagarinfotech.com/transport-management-software/fleet-management-software)
- [Ship.Cars SmartHaul TMS](https://ship.cars/smarthaul-tms) and [Driver ePOD](https://ship.cars/driver-epod)
- [Tracx TMS specialised carrier software](https://www.tracxtms.com/specialized-carrier-software)
- SEP\_LOADING\_DETAILS-26.xlsx (sheets SEP-26 and Sheet1), analysed 09-Nov-2026
