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
