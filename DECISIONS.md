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
