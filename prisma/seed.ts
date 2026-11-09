// `pnpm db:seed`: loads September 2026 from the fixture through the real importer.
// Re-running replaces only the September trips; masters and rate cards are kept.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { analyse, commitImport, readSheet } from "../src/server/services/import";

const db = new PrismaClient();

async function main() {
  const file = path.resolve(__dirname, "../tests/fixtures/SEP_LOADING_DETAILS-26.xlsx");
  const preview = await analyse(db, await readSheet(await readFile(file)));
  const r = await commitImport(db, preview, { user: "seed", replaceMonths: true });
  const t = preview.totals;
  console.log(
    `Seeded ${r.tripsCreated} trips (${preview.months.join(", ")}), replaced ${r.deletedTrips}, ` +
      `${r.rateCardsCreated} new rate cards. Cars ${t.cars}, revenue ₹${t.freight / 100}, cost ₹${t.totalCost / 100}. ` +
      `${preview.issues.length} issues flagged.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
