# FleetLedger — rules for Claude Code
Product: trip register + summaries for a car-carrier fleet in Gujarat. Spec: docs/SPEC.md.
Stack: Next.js 15 App Router, TypeScript strict, Tailwind + shadcn/ui, Prisma (SQLite for MVP,
Postgres later), zod, TanStack Table, Recharts, exceljs, Vitest.
Rules
- Money is integer paise. Never floats for money. Format via src/lib/format.ts (en-IN, ₹, lakh).
- All cost/profit maths lives ONLY in src/server/services/trip.ts compute().
  diesel_amount = diesel_l × rate; total_cost = diesel + pod + maint + trip allowance;
  profit = freight − total_cost.
- Every mutation is a server action: validate with shared zod schema, write an AuditLog row.
- Drivers, locations, dealers, vehicles are foreign keys to masters, never free text.
- LR number unique. Registration numbers upper-case, no spaces. Dates stored as dates, shown dd-MMM-yy.
- DEALER = the client dealer. TRIP = driver trip allowance. Salary is not split across trailers.
## Speed rules (MVP)
- Work autonomously. Do not stop to ask questions; make a reasonable choice and log it in DECISIONS.md.
- Do not ask for confirmation between steps. Continue until the whole task is done.
- Prefer working software over polish. No extra libraries, no refactors beyond the task.
- Tests only for money maths and the September import.
- After each milestone: pnpm test && pnpm build, fix errors, git commit, git push, keep going.
