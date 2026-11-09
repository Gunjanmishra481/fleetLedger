// Rate card and diesel price changes apply from a date: new trips get the new amounts,
// earlier dates (and already-saved trips) keep the old ones. SPEC phase 5 checklist.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { saveDieselRate, saveRateCard, deleteRateCard } from "@/server/services/masters";
import { autofill, destinationKey } from "@/server/services/trip";
import { rupeesToPaise as p } from "@/lib/money";

const db = new PrismaClient();
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
let origin: number;
let dest: number;

beforeAll(async () => {
  origin = (await db.location.create({ data: { name: "ZZ TEST LOADING", kind: "LOADING_POINT" } })).id;
  dest = (await db.location.create({ data: { name: "ZZ TEST CITY", kind: "DESTINATION" } })).id;
});

afterAll(async () => {
  await db.rateCard.deleteMany({ where: { originId: origin } });
  await db.location.deleteMany({ where: { id: { in: [origin, dest] } } });
  await db.dieselRate.deleteMany({ where: { effectiveFrom: { in: [d("2025-01-01"), d("2025-03-01")] } } });
  await db.auditLog.deleteMany({ where: { user: "rate-test" } });
  await db.$disconnect();
});

const card = (freight: number, from: string) => ({
  originId: origin,
  stopIds: [dest],
  freight: p(freight),
  stdDieselL: 80,
  driverAllowance: p(1000),
  podCharge: p(300),
  effectiveFrom: from,
});

describe("rate card versions", () => {
  it("a new rate from a date only affects trips on or after that date", async () => {
    await saveRateCard(db, card(15000, "2025-01-01"), "rate-test");
    await saveRateCard(db, card(16500, "2025-03-01"), "rate-test");
    const fill = (date: string) => autofill(db, { date: d(date), originId: origin, stopIds: [dest] });
    expect((await fill("2025-02-28")).freight).toBe(p(15000));
    expect((await fill("2025-03-01")).freight).toBe(p(16500));
    expect((await fill("2025-12-31")).freight).toBe(p(16500));
    expect((await fill("2024-12-31")).freight).toBeNull();

    const versions = await db.rateCard.findMany({ where: { originId: origin }, orderBy: { effectiveFrom: "asc" } });
    expect(versions.map((v) => v.effectiveTo?.toISOString().slice(0, 10) ?? null)).toEqual(["2025-02-28", null]);
    expect(versions[0].destinationKey).toBe(destinationKey([dest]));
  });

  it("saving the same route and date corrects that version instead of adding one", async () => {
    await saveRateCard(db, card(16600, "2025-03-01"), "rate-test");
    expect(await db.rateCard.count({ where: { originId: origin } })).toBe(2);
    expect((await autofill(db, { date: d("2025-04-01"), originId: origin, stopIds: [dest] })).freight).toBe(p(16600));
  });

  it("deleting the newest version reopens the previous one", async () => {
    const newest = await db.rateCard.findFirstOrThrow({ where: { originId: origin }, orderBy: { effectiveFrom: "desc" } });
    await deleteRateCard(db, newest.id, "rate-test");
    expect((await autofill(db, { date: d("2025-06-01"), originId: origin, stopIds: [dest] })).freight).toBe(p(15000));
  });
});

describe("diesel price from a date", () => {
  it("applies only from its date", async () => {
    await saveDieselRate(db, { ratePaise: p(95.5), effectiveFrom: "2025-01-01" }, "rate-test");
    await saveDieselRate(db, { ratePaise: p(97.25), effectiveFrom: "2025-03-01" }, "rate-test");
    expect((await autofill(db, { date: d("2025-02-15") })).dieselRate).toBe(p(95.5));
    expect((await autofill(db, { date: d("2025-03-02") })).dieselRate).toBe(p(97.25));
  });
});
