// Sheets with blank cells: rows with trip data import and are flagged "Missing details";
// pre-numbered empty rows are skipped; nothing blocks the import unless no row has a usable date.
import { afterAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { analyse, commitImport, readSheet, type Preview } from "@/server/services/import";
import { monthFlags } from "@/server/services/summary";
import { parseIncomplete } from "@/server/services/trip";
import { rupeesToPaise as p } from "@/lib/money";

const db = new PrismaClient();
const HEAD = ["F", "DATE", "TRAILER NO", "DRIVER", "LR NO", "FROM", "DESTINATION", "NO CAR", "DIESEL", "Rate/ltr", "Diesel Amount", "POD", "Maint", "TRIP", "Total Cost", "Trip Revenue", "Profit/Loss", "REMARK", "DEALER"];
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function sheet(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("OCT-25");
  ws.addRow(HEAD);
  for (const r of rows) ws.addRow(r);
  return readSheet(Buffer.from(await wb.xlsx.writeBuffer()));
}

afterAll(async () => {
  await db.trip.deleteMany({ where: { monthKey: { in: ["2025-10", "2025-11"] } } });
  const locs = await db.location.findMany({ where: { name: { startsWith: "ZZTEST" } }, select: { id: true } });
  await db.rateCard.deleteMany({ where: { originId: { in: locs.map((l) => l.id) } } });
  await db.location.deleteMany({ where: { name: { startsWith: "ZZTEST" } } });
  await db.vehicle.deleteMany({ where: { regNo: "ZZ01TEST0001" } });
  await db.driver.deleteMany({ where: { name: "ZZTEST DRIVER" } });
  await db.dieselRate.deleteMany({ where: { effectiveFrom: d("2025-10-01") } });
  await db.auditLog.deleteMany({ where: { user: "blank-test" } });
  await db.$disconnect();
});

describe("importing a sheet with blank cells", () => {
  let preview: Preview;

  it("imports every row that has trip data and skips empty template rows", async () => {
    preview = await analyse(
      db,
      await sheet([
        // complete
        [1, d("2025-10-01"), "ZZ01TEST0001", "ZZTEST DRIVER", 9001, "ZZTEST LOADING", "ZZTEST CITY", 6, 80, 98.36, null, 300, null, 1000, null, 15000, null, "", ""],
        // blank date, trailer and destination
        [2, null, null, "ZZTEST DRIVER", 9002, "ZZTEST LOADING", null, 7, 80, 98.36, null, 300, null, 1000, null, 16000, null, "", ""],
        // blank LR and loading point, cars typed as text, no freight
        [3, d("2025-10-02"), "ZZ01TEST0001", null, null, null, "ZZTEST CITY", "six", 70, 98.36, null, 300, null, 1000, null, null, null, "", ""],
        // pre-numbered template row: only serial, rate and POD
        [4, null, null, null, null, null, null, null, null, 98.36, null, 300, null, null, null, null, null, "", ""],
      ]),
    );
    expect(preview.issues.filter((i) => i.kind === "ERROR")).toEqual([]);
    expect(preview.trips).toHaveLength(3);
    expect(preview.issues.find((i) => i.kind === "SKIPPED_EMPTY")?.message).toMatch(/^1 empty row skipped/);
    expect(preview.issues.filter((i) => i.kind === "INCOMPLETE")).toHaveLength(2);
  });

  it("fills what it can and records what was blank", () => {
    const [ok, noPlaces, noLr] = preview.trips;
    expect(ok.incomplete).toEqual([]);
    expect(noPlaces.tripDate).toEqual(d("2025-10-01")); // date from the row above
    expect(noPlaces.regNo).toBeNull();
    expect(noPlaces.stopNames).toEqual([]);
    expect(noPlaces.incomplete.map((n) => n.field).sort()).toEqual(["date", "destination", "trailer"]);
    expect(noLr.lrNo).toBe("NOLR-2510-R4");
    expect(noLr.originName).toBeNull();
    expect(noLr.carsCount).toBe(0);
    expect(noLr.freight).toBe(0);
    expect(noLr.incomplete.map((n) => n.field).sort()).toEqual(["LR no.", "cars", "freight", "loading point"]);
  });

  it("saves the trips with money from compute() and flags the incomplete ones", async () => {
    await commitImport(db, preview, { user: "blank-test" });
    const trips = await db.trip.findMany({ where: { monthKey: "2025-10" }, include: { stops: true }, orderBy: { lrNo: "asc" } });
    expect(trips).toHaveLength(3);
    const ok = trips.find((t) => t.lrNo === "9001")!;
    expect(ok.totalCost).toBe(p(80 * 98.36 + 300 + 1000));
    expect(ok.incomplete).toBeNull();
    const noPlaces = trips.find((t) => t.lrNo === "9002")!;
    expect(noPlaces.vehicleId).toBeNull();
    expect(noPlaces.stops).toHaveLength(0);
    expect(parseIncomplete(noPlaces.incomplete).map((n) => n.field)).toContain("trailer");

    const flags = await monthFlags("2025-10");
    expect(flags.get(ok.id)?.some((f) => f.kind === "INCOMPLETE") ?? false).toBe(false);
    expect(flags.get(noPlaces.id)?.find((f) => f.kind === "INCOMPLETE")?.label).toBe("Missing: trailer, destination, date");
    const noLr = trips.find((t) => t.lrNo.startsWith("NOLR-"))!;
    expect(flags.get(noLr.id)?.find((f) => f.kind === "INCOMPLETE")?.label).toMatch(/LR no\..*cars.*freight/);
  });

  it("builds rate cards only from complete rows", async () => {
    const origin = await db.location.findUniqueOrThrow({ where: { name: "ZZTEST LOADING" } });
    const cards = await db.rateCard.findMany({ where: { originId: origin.id } });
    expect(cards).toHaveLength(1);
    expect(cards[0].freight).toBe(p(15000));
  });

  it("only refuses a sheet when no row has a usable date", async () => {
    const none = await analyse(db, await sheet([[1, null, "ZZ01TEST0001", null, 9101, "ZZTEST LOADING", "ZZTEST CITY", 6, 80, 98.36, null, 300, null, 1000, null, 15000]]));
    expect(none.trips).toHaveLength(0);
    expect(none.issues[0].kind).toBe("ERROR");
    await expect(commitImport(db, none, { user: "blank-test" })).rejects.toThrow(/Nothing to import/);
  });
});
