# FleetLedger

Trip register and profit summaries for a car-carrier fleet in Gujarat. It replaces the monthly
loading sheet: one trip is one record, costs and profit calculate themselves, and every trailer,
driver, route and month gets its own summary. Works on phone, tablet and PC.

- What it does and why: [docs/SPEC.md](docs/SPEC.md)
- How it should look and feel: [docs/DESIGN.md](docs/DESIGN.md)
- Choices made while building, worth reviewing: [DECISIONS.md](DECISIONS.md)

## Run locally

You need **Node.js 22** and **pnpm 10** (`npm install -g pnpm` if you don't have it).

```bash
# 1. Install dependencies (also generates the Prisma client)
pnpm install

# 2. Settings: copy the example and fill it in
cp .env.example .env
```

In `.env`:

| Key | Example | What it is |
| --- | --- | --- |
| `DATABASE_URL` | Neon **dev** branch, *pooled* URL + `&pgbouncer=true` | What the app uses |
| `DIRECT_URL` | Neon **dev** branch, *direct* URL | What migrations and tests use |
| `ADMIN_USER` | `"admin"` | Login name |
| `ADMIN_PASSWORD` | choose one | Login password |
| `AUTH_SECRET` | any long random text | Optional; signs the login cookie. If empty, the password is used, so changing the password signs everyone out |

Get both URLs from the Neon console (project **fleetledger** → branch **dev** → Connect) or with
`npx neonctl connection-string dev --pooled` / `npx neonctl connection-string dev`. Use the
**dev** branch locally, never **main**: main is the live data.

`.env` is git-ignored. Never commit it.

```bash
# 3. Create the tables (migrations) and load September 2026 from the sample sheet
pnpm db:seed

# 4. Start the app
pnpm dev
```

Open <http://localhost:3000> and sign in with `ADMIN_USER` / `ADMIN_PASSWORD`. The month chip
at the top starts on the current month; pick **Sep 2026** to see the imported trips.

### Try it on your phone or tablet

On the same Wi-Fi as your PC:

```bash
pnpm dev -H 0.0.0.0
```

Then open `http://<your-PC's-IP>:3000` on the phone (find the IP with `ipconfig` on Windows,
the "IPv4 Address" line). "Add to Home Screen" installs it like an app once it's served over
HTTPS (i.e. after deployment); on a local IP it still works in the browser.

### Re-loading data

- `pnpm db:seed` re-imports September from `tests/fixtures/SEP_LOADING_DETAILS-26.xlsx`.
  It replaces only September's trips; masters, rate cards and other months are kept.
- Other months: **More → Import** in the app, upload the month's `.xlsx`, check the preview, import.
- To start completely fresh, reset the **dev** branch from the Neon console (Branches → dev → Reset from parent) and run `pnpm db:seed`.

### Tests

```bash
pnpm test        # money maths, rate versions and the September import
```

Browser checks (screens at phone/tablet/PC sizes, trip entry, masters):

```bash
npx playwright install chromium   # first time only
pnpm build
pnpm test:e2e                     # screenshots in test-results/screens
```

Both test commands create a brand-new schema in the Neon **dev** branch, build it from the
migrations (the browser tests also load September), and drop it at the end, so they never touch
your dev data or production. They need `DIRECT_URL` and the login in `.env`.

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Development server on port 3000 |
| `pnpm build` / `pnpm start` | Production build / serve it |
| `pnpm db:migrate` | Apply new migrations in `prisma/migrations` (never deletes data) |
| `pnpm db:seed` | Migrate, then import September 2026 (replaces September only) |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | Browser tests (Playwright); build first |

## Deployment (Vercel + Neon)

Live at **https://fleetledger.vercel.app** (sign in as `admin` with the production password).

- **Hosting:** Vercel project `fleetledger`, region `sin1` (Singapore), connected to this GitHub
  repo: **every push to `main` deploys to production.** Build = `pnpm vercel-build`
  (`prisma generate && prisma migrate deploy && next build`), so new migrations apply on deploy.
- **Database:** Neon project `fleetledger` in `aws-ap-southeast-1` (Singapore). Branch **main** =
  production data; branch **dev** = local development and tests.
- **Production settings** live in Vercel → Project → Settings → Environment Variables:
  `DATABASE_URL` (main, pooled), `DIRECT_URL` (main, direct), `ADMIN_USER`, `ADMIN_PASSWORD`,
  `AUTH_SECRET`. Changing the password or secret there signs everyone out; redeploy to apply.
- **Changing the data model:** edit `prisma/schema.prisma`, then create a migration with
  `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script`
  saved as `prisma/migrations/<NNNN_name>/migration.sql`; check it with `pnpm test`, commit, push.
- **Backups:** Neon keeps a short point-in-time history of the main branch (hours on the free plan; restore from the Neon console). Also keep the monthly Excel export (Trips → Excel) as an offline copy.

## Where things live

| Path | What |
| --- | --- |
| `src/server/services/trip.ts` | `compute()`: the only place trip cost and profit are calculated. Also `autofill()` and `flags()` |
| `src/server/services/import.ts` | Excel import: read, clean up names, preview issues, commit |
| `src/server/services/masters.ts` | Trailers, drivers, places, dealers, rate card, diesel price (incl. merges) |
| `src/server/services/summary.ts` | Dashboard, trailer, driver and route summaries |
| `src/server/actions/` | Server actions: every change is validated (zod) and audit-logged |
| `src/app/(app)/` | Screens: Home, Trips, New trip, Fleet, Masters, Import |
| `src/components/fl/` | Shared UI: number plate, chips, steppers, receipt, sheets |
| `prisma/schema.prisma` | Data model. Money is integer paise |
