// September acceptance test (SPEC section 7, phase 1 checklist). Runs against prisma/test.db.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { analyse, commitImport, normaliseName, readSheet, splitStops, type Preview } from "@/server/services/import";
import { autofill } from "@/server/services/trip";
import { rupeesToPaise as p } from "@/lib/money";

const FIXTURE = path.resolve(__dirname, "../fixtures/SEP_LOADING_DETAILS-26.xlsx");
const db = new PrismaClient();
let preview: Preview;

beforeAll(async () => {
  const sheet = await readSheet(await readFile(FIXTURE));
  preview = await analyse(db, sheet);
  await commitImport(db, preview, { user: "test", replaceMonths: true });
}, 120_000);

afterAll(() => db.$disconnect());

describe("normalisation", () => {
  it("collapses spacing variants", () => {
    expect(normaliseName("OCPL(DETROJ)")).toBe("OCPL (DETROJ)");
    expect(normaliseName(" ocpl ( detroj ) ")).toBe("OCPL (DETROJ)");
    expect(splitStops("RAJKOT + JUNAGARH")).toEqual(splitStops("RAJKOT+JUNAGARH"));
  });
});

describe("September import preview", () => {
  it("reads sheet SEP-26 with every trip row", () => {
    expect(preview.sheetName).toBe("SEP-26");
    expect(preview.trips).toHaveLength(224);
    expect(preview.issues.filter((i) => i.kind === "ERROR")).toEqual([]);
  });

  it("reports the known data-quality problems", () => {
    const count = (k: string) => preview.issues.filter((i) => i.kind === k).length;
    expect(count("MISSING_DRIVER")).toBe(31);
    expect(preview.issues.find((i) => i.kind === "DUPLICATE_LR")?.message).toMatch(/LR 1384/);
    expect(count("DUPLICATE_LR")).toBe(1);
    expect(preview.issues.find((i) => i.kind === "DUPLICATE_SERIAL")?.message).toMatch(/Serial 205/);
    expect(count("ZERO_COST")).toBeGreaterThan(0);
  });
});

describe("September import totals (money maths through compute())", () => {
  it("has 224 trips, 1,467 cars and 29,525 L diesel", async () => {
    const agg = await db.trip.aggregate({
      where: { monthKey: "2026-09" },
      _count: { _all: true },
      _sum: { carsCount: true, dieselL: true },
    });
    expect(agg._count._all).toBe(224);
    expect(agg._sum.carsCount).toBe(1467);
    expect(agg._sum.dieselL).toBe(29525);
  });

  it("matches the sheet: revenue 63,19,590, cost 32,52,179, profit 30,67,411", async () => {
    const agg = await db.trip.aggregate({
      where: { monthKey: "2026-09" },
      _sum: { freight: true, totalCost: true, profit: true },
    });
    expect(agg._sum.freight).toBe(p(6319590));
    expect(agg._sum.totalCost).toBe(p(3252179));
    expect(agg._sum.profit).toBe(p(3067411));
  });
});

describe("September masters", () => {
  it("merges JAVAHIR / JAWAHIR into one driver with 24 trips", async () => {
    const d = await db.driver.findUnique({ where: { name: "JAVAHIR" }, include: { _count: { select: { trips: true } } } });
    expect(d?._count.trips).toBe(24);
    expect(await db.driver.findUnique({ where: { name: "JAWAHIR" } })).toBeNull();
    expect(await db.driverAlias.findUnique({ where: { alias: "JAWAHIR" } })).not.toBeNull();
  });

  it("turns 7 loading-point spellings into 6 locations", async () => {
    expect(await db.location.count({ where: { kind: "LOADING_POINT" } })).toBe(6);
  });

  it("has 18 trailers; NL01AL1658 and NL01N3654 have 25 trips each", async () => {
    expect(await db.vehicle.count()).toBe(18);
    for (const regNo of ["NL01AL1658", "NL01N3654"]) {
      expect(await db.trip.count({ where: { vehicle: { regNo } } })).toBe(25);
    }
  });

  it("keeps both trips that shared LR 1384", async () => {
    expect(await db.trip.count({ where: { lrNo: { in: ["1384", "1384-DUP"] } } })).toBe(2);
  });

  it("splits multi-drop destinations into ordered stops", async () => {
    const t = await db.trip.findFirstOrThrow({
      where: { stops: { some: { location: { name: "BHUJ" } } }, AND: { stops: { some: { location: { name: "GANDHIDHAM" } } } } },
      include: { stops: { orderBy: { seq: "asc" }, include: { location: true } } },
    });
    expect(t.stops.map((s) => s.location.name)).toEqual(["GANDHIDHAM", "BHUJ"]);
  });
});

describe("autofill() from the imported rate card", () => {
  it("OCPL -> Ahmedabad pre-fills ₹15,871 freight, ₹300 POD and ₹98.36 diesel", async () => {
    const origin = await db.location.findUniqueOrThrow({ where: { name: "OCPL (DETROJ)" } });
    const ahd = await db.location.findUniqueOrThrow({ where: { name: "AHMEDABAD" } });
    const a = await autofill(db, { date: new Date(Date.UTC(2026, 9, 1)), originId: origin.id, stopIds: [ahd.id] });
    expect(a.freight).toBe(p(15871));
    expect(a.podCharge).toBe(p(300));
    expect(a.driverAllowance).toBe(p(1000));
    expect(a.dieselRate).toBe(p(98.36));
  });

  it("suggests DALBIR for NL01N3650", async () => {
    const v = await db.vehicle.findUniqueOrThrow({ where: { regNo: "NL01N3650" }, include: { usualDriver: true } });
    expect(v.usualDriver?.name).toBe("DALBIR");
    const a = await autofill(db, { date: new Date(Date.UTC(2026, 8, 30)), vehicleId: v.id });
    expect(a.driverId).toBe(v.usualDriverId);
  });
});

describe("re-import", () => {
  it("refuses duplicate LRs unless replacing the month", async () => {
    await expect(commitImport(db, preview, { user: "test" })).rejects.toThrow(/already in the database/);
    const r = await commitImport(db, preview, { user: "test", replaceMonths: true });
    expect(r.deletedTrips).toBe(224);
    expect(await db.trip.count()).toBe(224);
  }, 120_000);
});
