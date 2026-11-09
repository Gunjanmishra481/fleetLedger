// Read-side queries for summaries, dashboard and flags. Money values come from columns written by compute().
import { db } from "../db";
import { destinationKey, flags, type Flag } from "./trip";
import { monthRange, shiftMonth } from "@/lib/month";

// ---------- flags ----------

/** Flags for every trip in a month, keyed by trip id. */
export async function monthFlags(monthKey: string): Promise<Map<number, Flag[]>> {
  const [trips, cards] = await Promise.all([
    db.trip.findMany({
      where: { monthKey },
      select: {
        id: true, tripDate: true, vehicleId: true, originId: true, dieselL: true, freight: true,
        totalCost: true, driverId: true, lrNo: true, carsCount: true, incomplete: true, stops: { select: { locationId: true } },
      },
    }),
    db.rateCard.findMany({ orderBy: { effectiveFrom: "desc" } }),
  ]);
  const sameDay = new Map<string, number>();
  for (const t of trips) {
    const k = `${t.vehicleId}|${t.tripDate.toISOString()}`;
    sameDay.set(k, (sameDay.get(k) ?? 0) + 1);
  }
  const out = new Map<number, Flag[]>();
  for (const t of trips) {
    const key = destinationKey(t.stops.map((s) => s.locationId));
    const rate = cards.find(
      (c) =>
        c.originId === t.originId &&
        c.destinationKey === key &&
        c.effectiveFrom <= t.tripDate &&
        (!c.effectiveTo || c.effectiveTo >= t.tripDate),
    );
    const sameDayTrips = t.vehicleId === null ? 1 : (sameDay.get(`${t.vehicleId}|${t.tripDate.toISOString()}`) ?? 1);
    const f = flags({ ...t, stopCount: t.stops.length }, { rate, sameDayTrips });
    if (f.length) out.set(t.id, f);
  }
  return out;
}

// ---------- month KPIs ----------

export type Kpis = {
  trips: number;
  cars: number;
  dieselL: number;
  freight: number;
  totalCost: number;
  profit: number;
  unbilled: number;
  activeTrailers: number;
  activeDrivers: number;
};

export async function monthKpis(monthKey: string): Promise<Kpis> {
  const [agg, unbilled, trailers, drivers] = await Promise.all([
    db.trip.aggregate({
      where: { monthKey },
      _count: { _all: true },
      _sum: { carsCount: true, dieselL: true, freight: true, totalCost: true, profit: true },
    }),
    db.trip.aggregate({ where: { monthKey, billingStatus: "UNBILLED" }, _sum: { freight: true } }),
    db.trip.groupBy({ by: ["vehicleId"], where: { monthKey } }),
    db.trip.groupBy({ by: ["driverId"], where: { monthKey, driverId: { not: null } } }),
  ]);
  return {
    trips: agg._count._all,
    cars: agg._sum.carsCount ?? 0,
    dieselL: agg._sum.dieselL ?? 0,
    freight: agg._sum.freight ?? 0,
    totalCost: agg._sum.totalCost ?? 0,
    profit: agg._sum.profit ?? 0,
    unbilled: unbilled._sum.freight ?? 0,
    activeTrailers: trailers.length,
    activeDrivers: drivers.length,
  };
}

export async function dashboard(monthKey: string) {
  const prevKey = shiftMonth(monthKey, -1);
  const { start, end } = monthRange(monthKey);
  const [kpis, prev, byDay, byTrailer, vehicles, flagMap] = await Promise.all([
    monthKpis(monthKey),
    monthKpis(prevKey),
    db.trip.groupBy({
      by: ["tripDate"],
      where: { monthKey },
      _count: { _all: true },
      _sum: { carsCount: true, freight: true, profit: true, dieselL: true },
    }),
    db.trip.groupBy({
      by: ["vehicleId"],
      where: { monthKey },
      _count: { _all: true },
      _sum: { profit: true, freight: true },
    }),
    db.vehicle.findMany({
      where: { active: true },
      select: { id: true, regNo: true, trips: { select: { tripDate: true }, orderBy: { tripDate: "desc" }, take: 1 } },
    }),
    monthFlags(monthKey),
  ]);

  const days: { day: string; trips: number; cars: number; freight: number; profit: number; dieselL: number }[] = [];
  for (let d = new Date(start); d < end; d = new Date(d.getTime() + 86_400_000)) {
    const hit = byDay.find((b) => b.tripDate.getTime() === d.getTime());
    days.push({
      day: d.toISOString().slice(0, 10),
      trips: hit?._count._all ?? 0,
      cars: hit?._sum.carsCount ?? 0,
      freight: hit?._sum.freight ?? 0,
      profit: hit?._sum.profit ?? 0,
      dieselL: hit?._sum.dieselL ?? 0,
    });
  }

  const reg = new Map(vehicles.map((v) => [v.id, v.regNo]));
  const ranked = byTrailer
    .filter((t): t is typeof t & { vehicleId: number } => t.vehicleId !== null)
    .map((t) => ({ vehicleId: t.vehicleId, regNo: reg.get(t.vehicleId) ?? "?", trips: t._count._all, profit: t._sum.profit ?? 0 }))
    .sort((a, b) => b.profit - a.profit);

  // Idle: no trip in the last 7 days of the month (or of today, if the month is current).
  const asOf = new Date(Math.min(end.getTime() - 86_400_000, Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())));
  const idle = vehicles
    .map((v) => {
      const last = v.trips[0]?.tripDate ?? null;
      const idleDays = last ? Math.floor((asOf.getTime() - last.getTime()) / 86_400_000) : null;
      return { vehicleId: v.id, regNo: v.regNo, lastTrip: last?.toISOString() ?? null, idleDays };
    })
    .filter((v) => v.idleDays === null || v.idleDays >= 7)
    .sort((a, b) => (b.idleDays ?? 9999) - (a.idleDays ?? 9999));

  const flagCounts = new Map<string, { label: string; count: number }>();
  for (const fs of flagMap.values()) {
    for (const f of fs) flagCounts.set(f.kind, { label: f.label, count: (flagCounts.get(f.kind)?.count ?? 0) + 1 });
  }

  return {
    kpis,
    prev,
    prevKey,
    days,
    top: ranked.slice(0, 5),
    bottom: ranked.slice(-5).reverse(),
    idle,
    flags: [...flagCounts]
      .map(([kind, v]) => ({ kind, ...v, label: kind === "INCOMPLETE" ? "Missing details" : v.label }))
      .sort((a, b) => Number(b.kind === "INCOMPLETE") - Number(a.kind === "INCOMPLETE") || b.count - a.count),
    flaggedTrips: flagMap.size,
  };
}

/** Most recent month that has trips (for empty-state links), or null. */
export async function latestMonthWithTrips(): Promise<string | null> {
  const t = await db.trip.findFirst({ orderBy: { tripDate: "desc" }, select: { monthKey: true } });
  return t?.monthKey ?? null;
}

/** Trailers on a trip on the given day vs idle, for the Home plate strip. */
export async function fleetToday(day: Date) {
  const [vehicles, today] = await Promise.all([
    db.vehicle.findMany({ where: { active: true }, orderBy: { regNo: "asc" }, select: { id: true, regNo: true, usualDriver: { select: { name: true } } } }),
    db.trip.groupBy({ by: ["vehicleId"], where: { tripDate: day }, _count: { _all: true } }),
  ]);
  return vehicles.map((v) => ({
    id: v.id,
    regNo: v.regNo,
    usualDriver: v.usualDriver?.name ?? null,
    tripsToday: today.find((x) => x.vehicleId === v.id)?._count._all ?? 0,
  }));
}

/** Trips per calendar day for a trailer or driver in a month: { "2026-09-01": 2, ... } */
export async function dayCounts(monthKey: string, where: { vehicleId?: number; driverId?: number }) {
  const rows = await db.trip.groupBy({ by: ["tripDate"], where: { monthKey, ...where }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.tripDate.toISOString().slice(0, 10), r._count._all]));
}

// ---------- drivers ----------

export async function driverList(monthKey: string) {
  const [drivers, stats] = await Promise.all([
    db.driver.findMany({ orderBy: { name: "asc" }, include: { aliases: true } }),
    db.trip.groupBy({
      by: ["driverId"],
      where: { monthKey },
      _count: { _all: true },
      _sum: { carsCount: true, driverAllowance: true, profit: true, dieselL: true },
    }),
  ]);
  const unassigned = stats.find((s) => s.driverId === null);
  return {
    rows: drivers.map((d) => {
      const s = stats.find((x) => x.driverId === d.id);
      return {
        id: d.id,
        name: d.name,
        aliases: d.aliases.map((a) => a.alias),
        trips: s?._count._all ?? 0,
        cars: s?._sum.carsCount ?? 0,
        allowance: s?._sum.driverAllowance ?? 0,
        profit: s?._sum.profit ?? 0,
        dieselL: s?._sum.dieselL ?? 0,
      };
    }),
    unassignedTrips: unassigned?._count._all ?? 0,
  };
}

export async function driverSummary(driverId: number, monthKey: string) {
  const driver = await db.driver.findUnique({ where: { id: driverId }, include: { aliases: true } });
  if (!driver) return null;
  const trips = await db.trip.findMany({
    where: { driverId, monthKey },
    orderBy: [{ tripDate: "asc" }, { serialNo: "asc" }],
    include: {
      vehicle: { select: { id: true, regNo: true } },
      origin: { select: { name: true } },
      stops: { orderBy: { seq: "asc" }, select: { location: { select: { name: true } } } },
    },
  });
  const trailers = groupSum(
    trips.filter((t) => t.vehicle),
    (t) => t.vehicle!.regNo,
    (t) => ({ id: t.vehicle!.id }),
  );
  const routes = groupSum(trips, (t) => routeName(t.origin?.name ?? "Unknown", t.stops.map((s) => s.location.name)));
  return {
    driver: { id: driver.id, name: driver.name, phone: driver.phone, aliases: driver.aliases.map((a) => a.alias) },
    totals: totalsOf(trips),
    activeDays: new Set(trips.map((t) => t.tripDate.toISOString())).size,
    tripDays: [...new Set(trips.map((t) => t.tripDate.toISOString().slice(0, 10)))],
    trailers,
    routes,
  };
}

// ---------- trailers ----------

export async function trailerList(monthKey: string) {
  const [vehicles, stats, days] = await Promise.all([
    db.vehicle.findMany({ orderBy: { regNo: "asc" }, include: { usualDriver: { select: { name: true } } } }),
    db.trip.groupBy({
      by: ["vehicleId"],
      where: { monthKey },
      _count: { _all: true },
      _sum: { carsCount: true, freight: true, totalCost: true, profit: true, dieselL: true },
    }),
    db.trip.groupBy({ by: ["vehicleId", "tripDate"], where: { monthKey } }),
  ]);
  const dim = daysInMonth(monthKey);
  return vehicles.map((v) => {
    const s = stats.find((x) => x.vehicleId === v.id);
    const active = days.filter((d) => d.vehicleId === v.id).length;
    return {
      id: v.id,
      regNo: v.regNo,
      ownerType: v.ownerType,
      usualDriver: v.usualDriver?.name ?? null,
      trips: s?._count._all ?? 0,
      cars: s?._sum.carsCount ?? 0,
      freight: s?._sum.freight ?? 0,
      totalCost: s?._sum.totalCost ?? 0,
      profit: s?._sum.profit ?? 0,
      dieselL: s?._sum.dieselL ?? 0,
      activeDays: active,
      utilisation: active / dim,
    };
  });
}

export async function trailerSummary(vehicleId: number, monthKey: string) {
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId }, include: { usualDriver: true } });
  if (!vehicle) return null;
  const sixBack = shiftMonth(monthKey, -5);
  const [trips, trend, cards] = await Promise.all([
    db.trip.findMany({
      where: { vehicleId, monthKey },
      orderBy: [{ tripDate: "asc" }, { serialNo: "asc" }],
      include: {
        driver: { select: { id: true, name: true } },
        origin: { select: { name: true } },
        stops: { orderBy: { seq: "asc" }, select: { locationId: true, location: { select: { name: true } } } },
      },
    }),
    db.trip.groupBy({
      by: ["monthKey"],
      where: { vehicleId, monthKey: { gte: sixBack, lte: monthKey } },
      _sum: { profit: true, freight: true },
      _count: { _all: true },
    }),
    db.rateCard.findMany({ orderBy: { effectiveFrom: "desc" } }),
  ]);

  // Diesel vs route standard, over trips whose route has a rate card.
  let dieselActual = 0;
  let dieselStd = 0;
  for (const t of trips) {
    const key = destinationKey(t.stops.map((s) => s.locationId));
    const rc = cards.find((c) => c.originId === t.originId && c.destinationKey === key && c.effectiveFrom <= t.tripDate);
    if (rc && t.totalCost > 0) {
      dieselActual += t.dieselL;
      dieselStd += rc.stdDieselL;
    }
  }

  const months: { monthKey: string; trips: number; profit: number; freight: number }[] = [];
  for (let k = sixBack; k <= monthKey; k = shiftMonth(k, 1)) {
    const hit = trend.find((x) => x.monthKey === k);
    months.push({ monthKey: k, trips: hit?._count._all ?? 0, profit: hit?._sum.profit ?? 0, freight: hit?._sum.freight ?? 0 });
  }

  // Destination breakdown (replaces the Sheet1 pivot): count by the destination text as entered.
  const destinations = groupSum(trips, (t) => t.stops.map((s) => s.location.name).join(" + "));
  const drivers = groupSum(trips, (t) => t.driver?.name ?? "— No driver —", (t) => ({ id: t.driver?.id ?? null }));
  const activeDays = new Set(trips.map((t) => t.tripDate.toISOString())).size;

  return {
    vehicle: { id: vehicle.id, regNo: vehicle.regNo, ownerType: vehicle.ownerType, usualDriver: vehicle.usualDriver?.name ?? null },
    totals: totalsOf(trips),
    activeDays,
    utilisation: activeDays / daysInMonth(monthKey),
    diesel: { actual: dieselActual, standard: dieselStd },
    months,
    destinations,
    drivers,
  };
}

// ---------- routes ----------

export async function routeSummary(monthKey: string) {
  const [trips, cards] = await Promise.all([
    db.trip.findMany({
      where: { monthKey },
      select: {
        originId: true, tripDate: true, freight: true, totalCost: true, profit: true, dieselL: true, carsCount: true,
        origin: { select: { name: true } },
        stops: { orderBy: { seq: "asc" }, select: { locationId: true, location: { select: { name: true } } } },
      },
    }),
    db.rateCard.findMany({ orderBy: { effectiveFrom: "desc" } }),
  ]);
  type Acc = {
    key: string; name: string; originId: number; firstStopId: number; trips: number; cars: number; freight: number;
    totalCost: number; profit: number; dieselL: number; costedTrips: number; costedDieselL: number; stdDieselL: number | null;
    rateFreight: number | null;
  };
  const map = new Map<string, Acc>();
  for (const t of trips) {
    if (t.originId === null || !t.origin || t.stops.length === 0) continue; // incomplete import: no route yet
    const destKey = destinationKey(t.stops.map((s) => s.locationId));
    const key = `${t.originId}|${destKey}`;
    let a = map.get(key);
    if (!a) {
      const rc = cards.find((c) => c.originId === t.originId && c.destinationKey === destKey && c.effectiveFrom <= t.tripDate);
      a = {
        key, name: routeName(t.origin.name, t.stops.map((s) => s.location.name)), originId: t.originId,
        firstStopId: t.stops[0]?.locationId ?? 0, trips: 0, cars: 0, freight: 0, totalCost: 0, profit: 0, dieselL: 0,
        costedTrips: 0, costedDieselL: 0, stdDieselL: rc?.stdDieselL ?? null, rateFreight: rc?.freight ?? null,
      };
      map.set(key, a);
    }
    a.trips++;
    a.cars += t.carsCount;
    a.freight += t.freight;
    a.totalCost += t.totalCost;
    a.profit += t.profit;
    a.dieselL += t.dieselL;
    if (t.totalCost > 0) {
      a.costedTrips++;
      a.costedDieselL += t.dieselL;
    }
  }
  return [...map.values()]
    .map((a) => ({ ...a, avgDieselL: a.costedTrips ? a.costedDieselL / a.costedTrips : null, margin: a.freight ? a.profit / a.freight : 0 }))
    .sort((x, y) => y.trips - x.trips || x.name.localeCompare(y.name));
}

// ---------- helpers ----------

export function routeName(origin: string, stops: string[]) {
  return `${origin} → ${stops.join(" + ")}`;
}

function daysInMonth(monthKey: string) {
  const { start, end } = monthRange(monthKey);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

type Money = { carsCount: number; dieselL: number; freight: number; totalCost: number; profit: number; driverAllowance: number };

function totalsOf(trips: Money[]) {
  return trips.reduce(
    (a, t) => ({
      trips: a.trips + 1,
      cars: a.cars + t.carsCount,
      dieselL: a.dieselL + t.dieselL,
      freight: a.freight + t.freight,
      totalCost: a.totalCost + t.totalCost,
      profit: a.profit + t.profit,
      allowance: a.allowance + t.driverAllowance,
    }),
    { trips: 0, cars: 0, dieselL: 0, freight: 0, totalCost: 0, profit: 0, allowance: 0 },
  );
}

function groupSum<T extends Money, X extends object = object>(
  trips: T[],
  keyOf: (t: T) => string,
  extra?: (t: T) => X,
) {
  type G = { name: string; trips: number; cars: number; freight: number; profit: number } & Partial<X>;
  const m = new Map<string, G>();
  for (const t of trips) {
    const k = keyOf(t);
    const g: G = m.get(k) ?? ({ name: k, trips: 0, cars: 0, freight: 0, profit: 0, ...(extra?.(t) ?? {}) } as G);
    g.trips++;
    g.cars += t.carsCount;
    g.freight += t.freight;
    g.profit += t.profit;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.trips - a.trips || a.name.localeCompare(b.name));
}
