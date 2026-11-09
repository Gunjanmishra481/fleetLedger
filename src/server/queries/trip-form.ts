import { db } from "../db";
import { autofill, destinationKey, nextLrNo } from "../services/trip";
import { istToday } from "@/lib/format";
import { toDateInput } from "@/lib/schemas/trip";

export type FormVehicle = {
  id: number;
  regNo: string;
  usualDriverId: number | null;
  usualDriver: string | null;
  tripsToday: number;
  tripsYesterday: number;
};
export type RecentRoute = {
  key: string;
  originId: number;
  origin: string;
  stopIds: number[];
  stops: string[];
  freight: number | null; // paise, from the rate card
  trips: number;
};
export type TripFormData = Awaited<ReturnType<typeof tripFormData>>;

/** The 6 most-used routes (origin + ordered stops) in the 30 days before `asOf`; topped up from all time. */
async function recentRoutes(asOf: Date): Promise<RecentRoute[]> {
  const since = new Date(asOf.getTime() - 30 * 86_400_000);
  const [trips, cards] = await Promise.all([
    db.trip.findMany({
      select: {
        tripDate: true,
        originId: true,
        origin: { select: { name: true } },
        stops: { orderBy: { seq: "asc" }, select: { locationId: true, location: { select: { name: true } } } },
      },
      orderBy: { tripDate: "desc" },
      take: 2000,
    }),
    db.rateCard.findMany({ orderBy: { effectiveFrom: "desc" } }),
  ]);
  const tally = (list: typeof trips) => {
    const m = new Map<string, RecentRoute>();
    for (const t of list) {
      const stopIds = t.stops.map((s) => s.locationId);
      const key = `${t.originId}|${stopIds.join("-")}`;
      const r = m.get(key);
      if (r) r.trips++;
      else {
        const rc = cards.find((c) => c.originId === t.originId && c.destinationKey === destinationKey(stopIds) && c.effectiveFrom <= asOf);
        m.set(key, {
          key, originId: t.originId, origin: t.origin.name, stopIds, stops: t.stops.map((s) => s.location.name),
          freight: rc?.freight ?? null, trips: 1,
        });
      }
    }
    return [...m.values()].sort((a, b) => b.trips - a.trips);
  };
  const recent = tally(trips.filter((t) => t.tripDate >= since && t.tripDate <= asOf));
  const seen = new Set(recent.map((r) => r.key));
  const fill = tally(trips).filter((r) => !seen.has(r.key));
  return [...recent, ...fill].slice(0, 6);
}

export async function tripFormData() {
  const today = istToday();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const [vehicles, counts, drivers, locations, dealers, routes, lrNo, fill] = await Promise.all([
    db.vehicle.findMany({
      where: { active: true },
      orderBy: { regNo: "asc" },
      select: { id: true, regNo: true, usualDriverId: true, usualDriver: { select: { name: true } } },
    }),
    db.trip.groupBy({ by: ["vehicleId", "tripDate"], where: { tripDate: { in: [today, yesterday] } }, _count: { _all: true } }),
    db.driver.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
    db.dealer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    recentRoutes(today),
    nextLrNo(db),
    autofill(db, { date: today }),
  ]);
  const count = (vehicleId: number, d: Date) =>
    counts.find((c) => c.vehicleId === vehicleId && c.tripDate.getTime() === d.getTime())?._count._all ?? 0;
  return {
    today: toDateInput(today),
    vehicles: vehicles.map<FormVehicle>((v) => ({
      id: v.id,
      regNo: v.regNo,
      usualDriverId: v.usualDriverId,
      usualDriver: v.usualDriver?.name ?? null,
      tripsToday: count(v.id, today),
      tripsYesterday: count(v.id, yesterday),
    })),
    drivers,
    loadingPoints: locations.filter((l) => l.kind === "LOADING_POINT"),
    destinations: locations.filter((l) => l.kind === "DESTINATION"),
    dealers,
    recentRoutes: routes,
    suggestedLr: lrNo,
    dieselRate: fill.dieselRate,
  };
}

/** Values to pre-fill the form when editing or duplicating a trip. */
export async function tripForEdit(id: number) {
  const t = await db.trip.findUnique({ where: { id }, include: { stops: { orderBy: { seq: "asc" } } } });
  if (!t) return null;
  return {
    id: t.id,
    tripDate: toDateInput(t.tripDate),
    lrNo: t.lrNo,
    vehicleId: t.vehicleId,
    driverId: t.driverId,
    originId: t.originId,
    stopIds: t.stops.map((s) => s.locationId),
    carsCount: t.carsCount,
    dieselL: t.dieselL,
    dieselRate: t.dieselRate,
    podCharge: t.podCharge,
    maintenance: t.maintenance,
    driverAllowance: t.driverAllowance,
    freight: t.freight,
    dealerId: t.dealerId,
    billingStatus: t.billingStatus as "UNBILLED" | "INVOICED" | "PAID",
    notes: t.notes,
  };
}
export type TripPrefill = NonNullable<Awaited<ReturnType<typeof tripForEdit>>>;
