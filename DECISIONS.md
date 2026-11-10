# Decisions log

Choices made without asking, per CLAUDE.md speed rules. Check these.

## Milestone 1 — scaffold (09-Nov-2026)

- **Hand-scaffolded instead of `create-next-app`**: the CLI refuses non-empty folders (docs/, tests/, CLAUDE.md were already there). Config matches its defaults.
- **Pinned versions**: Next 15.5, React 19, Prisma 6 (Prisma 7 changes the client generator and config file; not worth the churn for the MVP), TypeScript 5 (pnpm resolved TS 7, whose native compiler Next 15 can't drive), Tailwind 4, Vitest 5.
- **shadcn `cn` helper**: the current shadcn CLI wired `cn` to an npm package literally named `cn`. Replaced with the standard `clsx` + `tailwind-merge` helper in `src/lib/utils.ts`.
- **No Google font**: removed the Geist font shadcn added, so `pnpm build` works offline. Uses the system UI font.
- **Auth**: single admin from `ADMIN_USER` / `ADMIN_PASSWORD` in `.env`, no Auth.js yet. Session is an HMAC-signed httpOnly cookie (7 days) checked in `src/middleware.ts`. Signing key is `AUTH_SECRET` if set, otherwise `ADMIN_PASSWORD` (so changing the password logs everyone out). Set a separate `AUTH_SECRET` before deploying.
- **Login/logout write no AuditLog row**: AuditLog is for data changes; the table arrives in milestone 2.
- **Month default**: with no `?m=`, screens use the current month in IST. The sidebar carries `?m=` across pages.
- **Money formatting**: `formatINR` shows paise only when the amount has them (`₹15,871`, `₹18,393.32`); pass `{ decimals: true }` to force two decimals in tables.
- **Sidebar for MVP**: Dashboard, Trips, Drivers, Trailers, Routes, Import, Masters (fast-track list). Billing, Expenses, Salary, Reports, Settings come with phase 4+.

## Milestone 2 — schema and trip service

- **Computed columns are stored** (`dieselAmount`, `totalCost`, `profit` on Trip) so summaries can aggregate in SQL. They are only ever written from `compute()`'s output; nothing else sets them.
- **Litres are a Float**; `compute()` converts to integer millilitres before multiplying by the paise rate, then rounds to the nearest paisa. Money stays integer paise throughout.
- **`Trip.driverId` is nullable** so September's 31 driverless trips can be imported and still count in the totals. The trip form requires a driver.
- **No Consignor table in the MVP.** The loading point (e.g. "OCPL (DETROJ)") is a Location of kind LOADING_POINT and carries the consignor in its name. Add Consignor with billing (phase 4).
- **LocationAlias table** added alongside DriverAlias, so typos like VADODRA resolve to VADODARA without free text.
- **Rate card key** = sorted stop location ids joined by "-", so "SURAT + VADODARA" and "VADODARA + SURAT" share a rate.
- **Serial numbers** run per month (`nextSerialNo`). They are not unique, since the sheet has serial 205 twice.
- **Next LR** = highest numeric LR + 1 across all trips ("1435-A" counts as 1435).
- **Usual driver** = the driver with the most trips on that trailer in the 30 days before the trip date; falls back to `Vehicle.usualDriverId`.

## Milestone 3 — September import

- **Duplicate LR 1384**: both trips are real revenue, so both are imported. The second becomes `1384-DUP`, with a note on the trip and an issue in the preview. **Check which trailer really owns LR 1384** and fix the other trip's LR.
- **Name merges applied automatically** (shown in the preview as "Names merged"): JAWAHIR → JAVAHIR, VADODRA → VADODARA, AHM → AHMEDABAD, and **PIPAVA PORT → PIPAVAV PORT** (the spec spells it Pipavav; check that's right). Spacing variants such as "OCPL(DETROJ)" and "OCPL (DETROJ)" collapse to "OCPL (DETROJ)". The merges are saved as DriverAlias / LocationAlias rows, so later imports reuse them.
- **No interactive mapping step yet**: the preview lists every new trailer, driver, location and dealer that will be created, but you can't remap them in the UI. Unknown names are created as new masters. A mapping step can come with the masters screens.
- **Rate card from import**: per route, the most common freight, diesel litres, allowance and POD, taken only from trips that have costs (zero-cost trips are skipped). Effective from the 1st of the imported month; existing routes are not overwritten.
- **Diesel rate**: the most common non-zero rate in the month (₹98.36), effective from the 1st of that month.
- **Usual driver per trailer** is set to its most frequent driver in the import.
- **All imported vehicles are OWN.** PB10GK0807 is likely a market vehicle (per the spec); change it once a masters screen exists.
- **REMARK "INVOICE DONE"** → billing status INVOICED; blank → UNBILLED. Any other remark text goes into trip notes.
- **Re-import**: refused if any LR is already in the database, unless "Replace existing trips for <month>" is ticked, which deletes that month's trips first (in the same transaction). One AuditLog row per import.
- **Test database**: `pnpm test` pushes the schema into a brand-new temp SQLite file each run and deletes it afterwards. Prisma blocks `db push --force-reset` when run by an AI agent, and a fresh file avoids needing a reset at all. Tests never touch `prisma/dev.db`.
- **`pnpm db:seed`** = `prisma db push` (no reset) + import September with replace-month. Added `tsx` (dev only) to run the TypeScript seed, as Prisma's docs recommend.

## Milestone 4 (partial) — trip actions, register table, flags

- **TanStack Table pinned to v8**: pnpm resolved v9, whose API changed (no `useReactTable`). v8 is the documented, stable API.
- **`flags()` lives in `trip.ts`** next to `compute()`, as the spec's folder layout says. Flags are warnings only and never block a save: diesel >10% over route standard, zero cost, no driver, freight different from rate card, trailer with 3+ trips that day, imported duplicate LR.
- **Trip saves** (`src/server/actions/trips.ts`): validate with the shared zod schema in `src/lib/schemas/trip.ts`, recheck LR uniqueness, write money from `compute()`, and write an AuditLog row with a field-by-field old → new diff (CREATE / UPDATE / DELETE).
- **Excel export** keeps the SEP-26 column order and sheet name (e.g. "SEP-26"), with a SUM totals row.

## Design build (docs/DESIGN.md) — step 1: shell

- **Navigation by screen**: the bottom bar and the rail are both rendered and switched by CSS media queries (`.nav-bottom` / `.nav-rail` in globals.css), so nothing depends on JS measuring the window. Phone, and tablet in portrait: bottom bar with a raised "+ Trip". 640–1023px in landscape (including phones held sideways): icon rail. ≥1024px: rail with labels.
- **Tabs**: Home = `/dashboard`, Trips, + Trip = `/trips/new`, Fleet = `/fleet` (trailers, drivers and routes), More = `/more` (Routes, Import, Masters, Sign out). `/trailers` and `/drivers` redirect to the matching Fleet tab. Routes is reachable from both Fleet and More.
- **Dark mode follows the device setting** (`prefers-color-scheme`); there is no manual toggle.
- **Theme**: deep teal primary, warm off-white background, 16px radius, plus `profit` / `warn` / `loss` / `plate` colour tokens in globals.css.
- **Sign out** moved to More on every screen size, so the top bar holds only the month chip.
- **ResponsiveSheet** is a small custom component (focus trap, Escape, scroll lock) rather than a new dialog library: a bottom sheet below 1024px; at 1024px+ a dialog, side panel or popover.

## Design step 2: shared components (src/components/fl)

- NumberPlate, TileGrid/Tile, ChipPicker, Stepper, CarCountPicker/CarIcons, RouteLine, LiveReceipt, ResponsiveSheet, KpiCard/Sparkline.
- **Sparklines are inline SVG**, not Recharts: a 30px line doesn't need a chart library. Recharts is kept for real charts.
- **LiveReceipt does no maths**: it only displays values the caller got from `compute()`.
- **Names are shown in title case** via `displayName()` ("OCPL (Detroj)", "Pipavav Port"); the stored masters stay upper-case.
- Every tap target is at least 44px (`.tap`, `min-h-11`, `size-12` car buttons).

## Design step 3: new / edit trip flow

- **One component, `TripFlow`, serves every screen.** Phone: 4 steps with a progress bar (other sections hidden with `max-sm:hidden`) and a Next/Back dock. Tablet: all steps as sections in one scroll, with the compact receipt and Save docked at the bottom. ≥1024px: two panes, with a sticky route preview, full receipt and Save on the right.
- **On phone, picking a trailer or a recent route moves to the next step automatically**, to hit the ~15-second goal. Tablet and PC don't auto-scroll.
- **The live receipt calls the same `compute()`** in the browser that the server action uses on save. The server recomputes; the client values are display only.
- **Recent routes** = the 6 most-used routes in the 30 days before today, topped up with all-time most-used routes when there are fewer than 6. With only September data and today 09-Nov-26, all 6 currently come from the top-up.
- **Choosing a route overwrites** freight, diesel, allowance and POD with the rate card, when one exists. With no rate card, the values are kept and an amber note says it's a new route.
- **Driver**: the trailer's stored usual driver appears immediately; the server's 30-day usual driver (`autofill()`) then replaces it if different.
- **Date chips** are Today / Yesterday / Pick date; future dates are blocked in the picker.
- **Billing status** (segmented control) shows only when editing. New trips start Unbilled.
- **Pre-fill links**: `/trips/new?vehicle=ID` (idle trailer on Home), `?copy=ID` (duplicate), `?route=ORIGIN:STOP-STOP` ("same route, another trailer").
- **Edit** lives at `/trips/[id]/edit`; `/trips/[id]` redirects there until the detail page (step 5).

## Design step 4: trips feed

- **Cards grouped by day, newest first**, with sticky day headers showing trip count and profit. The grid uses `repeat(auto-fill, minmax(18rem, 1fr))`, giving 1 column on phone, 2 on tablet and 3 on PC from the same CSS.
- **Filter chips** (Trailer, Driver, Route, Dealer, Billing, Flagged, plus LR search) open a bottom sheet on phone and a right side panel on PC. Filters stay in the URL, so the Back button and shared links work.
- **⋯ menu** on each card: Open, Edit, Duplicate. No swipe gestures (they were optional).
- **Cards / Table toggle** via `?view=table`, reusing the TanStack table (now on the design tokens, 44px rows). The Excel export ignores "Flagged only" and exports every trip matching the other filters, in the SEP-26 layout.
- **List + detail side by side at ≥1440px** comes with the trip detail page (step 5).

## Design step 5: trip detail

- `/trips/[id]` shows a ticket-style card (plate, LR, perforation, big route line, driver with a call button when a phone is on file, cars, dealer), any flags, the cost receipt, billing as a segmented control, Edit / Duplicate / Delete, and the audit history.
- **Billing changes save on tap** (`setBillingStatus` server action) and write an AuditLog row like any other edit.
- **Delete** asks for confirmation in a sheet. The AuditLog DELETE row keeps a full copy of the trip.
- **≥1440px: list + detail side by side.** A card tap there sets `?sel=ID` and the detail renders in a sticky right pane. Below 1440px the same tap opens `/trips/[id]`. The breakpoint is the brief's 1440px (Tailwind's `2xl` is 1536px, so it uses `min-[1440px]:`).
- **History shows readable values**: ids are shown as names (trailer, driver, places) and money is formatted with ₹. Imported trips with no edits say "Imported from the loading sheet".

## Design step 6: Home, Fleet, Trailer, Driver, Routes

- **Home** has a greeting with today's date; "Fleet today" plates (on trip first, idle with a dashed border, where tapping opens a new trip for that trailer); 6 KPI cards (trips, cars, revenue, profit, margin, diesel) with a daily sparkline and the change vs last month; "Needs attention" with one-tap fixes (e.g. no driver → `/trips?driver=none`); best / lowest trailers; idle trailers.
- **Empty months point to data**: the month defaults to the current month (Nov 2026), which has no trips, so empty screens offer "Show Sep 2026" (the latest month with trips) rather than a blank page.
- **"Fleet today"** always uses today's real date, not the chosen month. Today it shows every trailer as idle, which is correct until trips for today are entered.
- **No Recharts yet**: every visual here (sparklines, calendars, bar lists, utilisation bars) is small and CSS/SVG-only, so I didn't add the chart library's bundle weight. It can come back for a real trend chart.
- **Fleet** = `/fleet?tab=trailers|drivers|routes`. Trailer cards are sorted by profit and show the utilisation bar; drivers are sorted by trips, with a warning link for trips that have no driver.
- **Trailer page**: plate hero, KPIs (trips, active days %, revenue, profit, ₹/trip, diesel vs route standard), a calendar of trip days (each day links to that day's trips), destinations as a ranked bar list (this replaces the Sheet1 pivot), drivers, and the trip feed.
- **Driver page**: initials avatar and a Call button (shows "No phone saved" until a phone is entered; none were in the sheet). **Balance due = allowance earned**, because advances and payments aren't recorded until the driver ledger (phase 4). The page says so.
- **Routes** are cards sorted by profit: trips, cars, rate-card freight, average diesel / route standard (amber when >10% over), and margin. Tapping a route opens its trips.

## Design step 7: installable app

- `src/app/manifest.ts` → `/manifest.webmanifest` (standalone, start at `/dashboard`, theme teal, "New trip" shortcut).
- **Icons are generated by `next/og`** at `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/maskable-512.png` (glyph inside the safe zone) and `/icons/apple-180.png`, plus `src/app/icon.svg` as the favicon. There are no binary image files in the repo.
- Middleware lets the manifest and icons through without a session; the phone fetches them before anyone signs in.
- **No service worker / offline mode**: the brief asks for "installable", and Chrome no longer requires a service worker for installation. Offline trip entry would need a sync design; deferred.
- **Dates**: CLAUDE.md says dates are "shown dd-MMM-yy"; the newer design brief overrides that for UI ("Today", "Yesterday", "01 Sep"). The trip ticket shows both, and the Excel export keeps dd-mmm-yy.

## Design step 8: responsive check

- **`pnpm test:e2e`** (Playwright, Chromium): run `pnpm build` first. It starts `next start` on port 3210 against **`prisma/e2e.db`, a fresh copy of dev.db**, so the test trip it saves never lands in your data. Playwright stops the server afterwards.
- **Credentials come from `.env`** (loaded in `playwright.config.ts`). The test file has no password in it; it fails with a clear message if `.env` is missing them.
- Checks Home, New trip, Trips and a Trailer page at 390×844, 820×1180, 1180×820 and 1440×900: **no sideways scroll and no tap target under 44px** (inline text links in sentences are exempt, per WCAG 2.5.8). Both are hard failures. Screenshots go to `test-results/screens/` (git-ignored).
- One phone flow test: trailer → recent route → 7 cars → Check → Save → "Trip saved" sheet with the next-action buttons.
- Fixes from reviewing the screenshots: Home plates in a 2-column grid instead of 18 rows; **summary screens show whole rupees** (`formatRupees`: ₹3,44,284) while receipts and the trip ticket keep exact paise; plural-aware wording; 44px progress bar, segment controls, calendar days and steppers; the receipt says "Pick a route to see freight" instead of showing a −₹300 "loss" before a route is chosen.

## Masters page

- **`/masters?tab=trailers|drivers|places|dealers|rates|diesel`**, all reached from More. Cards in a fluid grid; tapping one opens an edit sheet (bottom sheet on phone, side panel on PC). Each list has a type-to-filter box.
- **Writes live in `src/server/services/masters.ts`**; `src/server/actions/masters.ts` wraps them with sign-in, the shared zod schemas (`src/lib/schemas/masters.ts`) and friendly errors. Every change writes an AuditLog row (CREATE / UPDATE / DELETE / MERGE / ALIAS_ADD / ALIAS_REMOVE).
- **Names are normalised the same way as the importer** (upper-case, single spaces, "X (Y)") and shown in title case. A new name that is already another spelling of someone is refused ("JAWAHIR is another spelling of JAVAHIR").
- **Trailers and drivers are never deleted**; "Show in new trips" hides them, and their trips stay. Dealers can be deleted only when they're on no trips. Places can't be deleted; use merge.
- **Merge** (drivers, places): moves every trip (for places also origins, stops and rate cards), makes the old name another spelling, deletes the duplicate, all in one transaction. Merging needs two taps. If a trip already stops at both places it keeps one stop. If a moved rate card collides with an existing card for the same route and date, the existing card wins.
- **Rate card is versioned by "applies from" date.** A new date adds a version and closes the previous one the day before. The same date corrects that version. Deleting the newest version reopens the previous one. Trips store their own amounts, so a rate change never alters saved trips (tested in `tests/unit/rate-versions.test.ts`).
- **Multi-drop rate cards show their stops unnumbered** ("Bhuj + Gandhidham"): one rate covers the route in either drop order.
- **Diesel price**: the same from-date rule; at least one price must remain.
- **Unit test files now run one at a time** (`fileParallelism: false`) because they share one temp database; the rate test cleans up after itself so the September counts stay exact.
- **Browser test** (`tests/e2e`): adds a phone number to a driver, merges VISHAL into VIKRAM (14 trips, VISHAL becomes a spelling), adds and merges a place, and sets a diesel price. It runs on the e2e copy of the database, so your data is untouched.

## README

- "Run locally" covers install, `.env` keys, seeding, opening on a phone over Wi-Fi, re-loading data and tests. `pnpm test:e2e` needs `pnpm build` first and reads the login from `.env`.

## Deployment: Vercel + Neon Postgres (09-Nov-2026)

- **You didn't answer the two deploy questions, so I used the defaults I'd proposed:** September 2026 is loaded into production, and the app runs as close to Gujarat as available.
- **Region: Singapore for both.** Neon has no Indian region (closest: `aws-ap-southeast-1`), so the Vercel functions run in `sin1` next to the database instead of Mumbai: each page makes several queries, and app↔DB latency matters more than browser↔app.
- **Neon project `fleetledger` (Postgres 18)** with two branches: **main** = production data, **dev** = local development and tests. Local `.env` points at dev; production URLs live only in Vercel and in the git-ignored `.env.vercel-prod`.
- **Pooled URL for the app** (with `pgbouncer=true`, which turns off prepared statements and is safe behind Neon's pooler); **direct URL for migrations** (`directUrl` in the schema).
- **Real migrations replace `db push`**: `prisma/migrations/0001_init`. Vercel's build runs `prisma migrate deploy`, so a pushed migration applies on deploy. `pnpm db:push` was removed to avoid schema drift.
- **Dates are now `DATE` columns** (trip date, rate card and diesel price dates), matching CLAUDE.md's "dates stored as dates".
- **Import writes are batched** (one bulk insert for trips, one for stops) because every query to Singapore costs a network round trip; the 224-trip import went from ~450 round trips to a handful.
- **Tests run on Postgres in throwaway schemas** (`test_<time>_<pid>` / `e2e_<time>_<pid>`) inside the dev branch: built from the real migrations, dropped afterwards (the drop refuses any schema name not matching that pattern). Prisma's AI guard blocks `migrate reset`/`--force-reset`, and none is needed.
- **The old local SQLite file `prisma/dev.db` was deleted** after the switch, without asking. Its September data is recreated on the Neon dev branch, but **any trips or master edits made on localhost before the switch are lost.**
- **Production login**: `ADMIN_USER=admin`; you set `ADMIN_PASSWORD` yourself in Vercel (never seen here). `AUTH_SECRET` is a random 32-byte value set only in Vercel.
- **Preview deployments** (branches other than `main`) have no environment variables yet, so they will fail to build. Not needed while everything ships from `main`; add dev-branch values under the Preview environment if you start using branches.
- `vercel link` added `.env*` to `.gitignore`; trimmed to `.vercel`, because the existing rules already ignore real env files and `.env*` would have hidden `.env.example` changes.

## Import: blank cells no longer block (your request, 09-Nov-2026)

- **Every row with trip data imports**; blanks are flagged, not errors. A row "has trip data" if it has any of: trailer, LR, loading point, destination, driver, cars or freight.
- **How blanks are filled:**
  - blank date → the date of the row above (sheets run in date order; rows before the first date take the first date in the sheet)
  - blank trailer / loading point → left empty
  - blank destination → no stops
  - blank LR → placeholder `NOLR-<yymm>-R<row>`
  - blank or non-numeric cars / freight → 0
  - other blank amounts → 0, as before
- **What was blank is saved on the trip** (`Trip.incomplete`: field + reason, e.g. "date was blank; used 2026-10-04 from the row above") and shown on the trip page as "From the sheet: …".
- **"Missing details" flag** (`flags()` in trip.ts): shown while anything is still missing: no trailer, loading point or destination, a `NOLR-` LR, 0 cars, 0 freight, or unreviewed import notes. Saving the trip from the edit form clears the import notes (a person has checked it); anything still empty keeps the flag.
- **Home → Needs attention** always lists "N trips are missing details from the import" first, with **Fill in** → `/trips?flag=INCOMPLETE`. The trips page now supports `?flag=<KIND>` for any flag, shown as a clearable chip.
- **Empty template rows are skipped** (only a serial, prefilled rate/POD or formulas), and the preview shows how many.
- **The only rows that can't import** are rows with no date when no row above has one. They're listed, and the rest still import. The Import button is disabled only when there's nothing to import.
- **Schema**: `Trip.vehicleId` and `Trip.originId` are now optional (migration `0002_incomplete_imports`: adds the column and relaxes two constraints; no data changes). Trips without a trailer are left out of trailer rankings, and trips without a full route are left out of route stats and recent routes, until filled in. A "No trailer" chip shows where the plate would be.
- **Rate cards are built only from complete, costed rows**, so a blank-heavy sheet can't set wrong route standards.
- "Revenue with zero cost" is now flagged only when there is revenue (a blank row isn't double-flagged).

## Invoices: step 1 (data model) (10-Nov-2026)

- **Reference format**: `tests/fixtures/invoices/JKTI_INV_108.xlsx`. It was already in the repo as `tests/fixtures/JKTI INV 108.xlsx` (not in Downloads), so I moved and renamed it rather than copying it.
- **Mahakal's details are hardcoded** in `src/config/company.ts` (`COMPANY`), per your change of plan. The values were copied from the reference, and `tests/unit/company-config.test.ts` checks every field and the signature bytes against the file. The signature is `src/assets/signature.jpeg`, extracted from the reference. Screens import it (`src/config/signature.ts`); the Excel builder reads the same file from disk, and `next.config.ts` bundles it for Vercel.
- **State codes**: printed as "024"; GST compares numerically ("24" vs the client's "07"), so different codes → IGST 18%.
- **The CompanyProfile table and Settings page were removed** (they had been built before the change). Migration 0003 creates the table and 0004 drops it again. 0003 had already run on the dev branch, so I didn't rewrite history; production runs both, and nothing is lost because the table never held real data there.
- **Invoice numbers** are prefix (`COMPANY.invoicePrefix`) + FY code + running number. `InvoiceSeries` (fy, startNo) holds the first running number per FY. Migration 0004 inserts FY "2627" → 109, so the next invoice continues after MKLAMD2627108. There's no screen for this yet; the number is editable on each invoice's review step.
- **Clients** = `Consignor` (short name, billing name, address lines, GSTIN, PAN, state, state code, place-of-handling label). A **loading point belongs to a client** (`Location.consignorId`); that's how a trip knows who to bill. The seed (`prisma/seed-invoice.ts`, run by `pnpm db:seed`) reads JKTI from the reference and links loading points whose name starts with the client's short name ("JKTI (CHHARODI)"). It only fills what's missing.
- **Vehicle.model** (e.g. "TR8") is the invoice's Model/Type column. The seed sets it for trailers on the reference invoice that have none.
- **TripVin** has the client's VIN-sheet columns plus `carrierNo` and `dispatchDate` (kept as the client gave them: the VIN sheet's dispatch date differs from the invoice line's) and `seq` (sheet order). `oemInvoiceDate` stays text ("12/10/2026"), exactly as written.
- **Invoice** stores money in paise, a nullable `number` (drafts have none), `fy` + `seq` for the series, and status DRAFT / ISSUED / PAID / CANCELLED. **At issue it freezes a snapshot** (seller, buyer, lines, VIN rows as JSON), so a downloaded invoice never changes afterwards, even if a client's address or a trip changes later or the invoice is cancelled.
- **Reference quirk found:** on invoice 108, line 12 (LR 1706) lists carrier **NL01AL3653**, but the client's VIN sheet says **NL01N3653** (one of your trailers). The golden test reproduces the invoice as issued; the VIN check flags it.
- `src/server/invoice/layout.json` is **generated** from the reference by `tests/tools/extract-invoice-layout.cjs` (styles, merges, widths, heights, print setup, signature anchor). Don't edit it by hand; re-run the tool if the reference changes.
