// The ONLY place trip money is calculated (CLAUDE.md). Form, importer and summaries all use compute().
import type { DbTx } from "../db";
import type { Paise } from "@/lib/money";

export type CostInput = {
  dieselL: number; // litres, up to 3 decimals
  dieselRate: Paise; // paise per litre
  podCharge: Paise;
  maintenance: Paise;
  driverAllowance: Paise;
  freight: Paise;
};

export type Computed = { dieselAmount: Paise; totalCost: Paise; profit: Paise };

function assertPaise(name: string, v: number) {
  if (!Number.isInteger(v)) throw new Error(`${name} must be integer paise, got ${v}`);
}

/**
 * diesel_amount = diesel_l × rate
 * total_cost    = diesel + pod + maint + trip allowance
 * profit        = freight − total_cost
 */
export function compute(i: CostInput): Computed {
  for (const k of ["dieselRate", "podCharge", "maintenance", "driverAllowance", "freight"] as const) {
    assertPaise(k, i[k]);
  }
  if (!Number.isFinite(i.dieselL) || i.dieselL < 0) throw new Error(`dieselL must be >= 0, got ${i.dieselL}`);
  // Litres -> integer millilitres first, so the multiply is exact integer maths.
  const ml = Math.round(i.dieselL * 1000);
  const dieselAmount = Math.round((ml * i.dieselRate) / 1000);
  const totalCost = dieselAmount + i.podCharge + i.maintenance + i.driverAllowance;
  return { dieselAmount, totalCost, profit: i.freight - totalCost };
}

/** Rate-card key for a set of drop locations: order-independent ("SURAT + VADODARA" = "VADODARA + SURAT"). */
export function destinationKey(stopIds: readonly number[]): string {
  return [...new Set(stopIds)].sort((a, b) => a - b).join("-");
}

export function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type Autofill = {
  driverId: number | null;
  freight: Paise | null;
  dieselL: number | null; // route standard
  driverAllowance: Paise | null;
  podCharge: Paise | null;
  dieselRate: Paise | null;
  rateCardId: number | null;
};

/**
 * Pre-fill values for a new trip: usual driver for the trailer (most trips in the last 30 days,
 * else the vehicle's usualDriver), the rate card for origin + stops effective on the date,
 * and the diesel rate effective on the date.
 */
export async function autofill(
  db: DbTx,
  q: { date: Date; vehicleId?: number | null; originId?: number | null; stopIds?: number[] },
): Promise<Autofill> {
  const out: Autofill = {
    driverId: null,
    freight: null,
    dieselL: null,
    driverAllowance: null,
    podCharge: null,
    dieselRate: null,
    rateCardId: null,
  };

  if (q.vehicleId) {
    const since = new Date(q.date.getTime() - 30 * 86_400_000);
    const top = await db.trip.groupBy({
      by: ["driverId"],
      where: { vehicleId: q.vehicleId, driverId: { not: null }, tripDate: { gte: since, lte: q.date } },
      _count: { driverId: true },
      orderBy: { _count: { driverId: "desc" } },
      take: 1,
    });
    out.driverId =
      top[0]?.driverId ??
      (await db.vehicle.findUnique({ where: { id: q.vehicleId }, select: { usualDriverId: true } }))
        ?.usualDriverId ??
      null;
  }

  if (q.originId && q.stopIds?.length) {
    const rc = await db.rateCard.findFirst({
      where: {
        originId: q.originId,
        destinationKey: destinationKey(q.stopIds),
        effectiveFrom: { lte: q.date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: q.date } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (rc) {
      out.rateCardId = rc.id;
      out.freight = rc.freight;
      out.dieselL = rc.stdDieselL;
      out.driverAllowance = rc.driverAllowance;
      out.podCharge = rc.podCharge;
    }
  }

  // Rate effective on the date; for dates before the first recorded rate, use the earliest one.
  const dr =
    (await db.dieselRate.findFirst({ where: { effectiveFrom: { lte: q.date } }, orderBy: { effectiveFrom: "desc" } })) ??
    (await db.dieselRate.findFirst({ orderBy: { effectiveFrom: "asc" } }));
  out.dieselRate = dr?.ratePaise ?? null;
  return out;
}

/** Next LR: highest numeric LR + 1 ("1454", "1435-A" -> "1455"). */
export async function nextLrNo(db: DbTx): Promise<string> {
  const rows = await db.trip.findMany({ select: { lrNo: true } });
  let max = 0;
  for (const { lrNo } of rows) {
    const n = Number.parseInt(lrNo, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

/** Next serial number within a month. */
export async function nextSerialNo(db: DbTx, monthKey: string): Promise<number> {
  const agg = await db.trip.aggregate({ where: { monthKey }, _max: { serialNo: true } });
  return (agg._max.serialNo ?? 0) + 1;
}
