import { db } from "../db";
import { toDateInput } from "@/lib/schemas/trip";

export async function mastersData() {
  const [vehicles, drivers, locations, dealers, cards, diesel, originUse, stopUse] = await Promise.all([
    db.vehicle.findMany({
      orderBy: [{ active: "desc" }, { regNo: "asc" }],
      include: { usualDriver: { select: { name: true } }, _count: { select: { trips: true } } },
    }),
    db.driver.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { aliases: { orderBy: { alias: "asc" } }, _count: { select: { trips: true } } },
    }),
    db.location.findMany({ orderBy: { name: "asc" }, include: { aliases: { orderBy: { alias: "asc" } } } }),
    db.dealer.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { trips: true } } } }),
    db.rateCard.findMany({ orderBy: [{ originId: "asc" }, { destinationKey: "asc" }, { effectiveFrom: "desc" }] }),
    db.dieselRate.findMany({ orderBy: { effectiveFrom: "desc" } }),
    db.trip.groupBy({ by: ["originId"], _count: { _all: true } }),
    db.tripStop.groupBy({ by: ["locationId"], _count: { _all: true } }),
  ]);
  const locName = new Map(locations.map((l) => [l.id, l.name]));

  // Rate card grouped by route; newest version first.
  const routes = new Map<string, { key: string; originId: number; origin: string; stopIds: number[]; stops: string[]; versions: typeof cards }>();
  for (const c of cards) {
    const key = `${c.originId}|${c.destinationKey}`;
    const stopIds = c.destinationKey.split("-").map(Number);
    const r = routes.get(key) ?? {
      key,
      originId: c.originId,
      origin: locName.get(c.originId) ?? "?",
      stopIds,
      stops: stopIds.map((s) => locName.get(s) ?? "?"),
      versions: [],
    };
    r.versions.push(c);
    routes.set(key, r);
  }

  return {
    vehicles: vehicles.map((v) => ({
      id: v.id,
      regNo: v.regNo,
      ownerType: v.ownerType as "OWN" | "MARKET",
      usualDriverId: v.usualDriverId,
      usualDriver: v.usualDriver?.name ?? null,
      active: v.active,
      trips: v._count.trips,
    })),
    drivers: drivers.map((d) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      active: d.active,
      trips: d._count.trips,
      aliases: d.aliases.map((a) => ({ id: a.id, alias: a.alias })),
    })),
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind as "LOADING_POINT" | "DESTINATION",
      district: l.district,
      aliases: l.aliases.map((a) => ({ id: a.id, alias: a.alias })),
      uses: (originUse.find((o) => o.originId === l.id)?._count._all ?? 0) + (stopUse.find((s) => s.locationId === l.id)?._count._all ?? 0),
    })),
    dealers: dealers.map((d) => ({ id: d.id, name: d.name, city: d.city, phone: d.phone, trips: d._count.trips })),
    rateRoutes: [...routes.values()]
      .map((r) => ({
        ...r,
        versions: r.versions.map((v) => ({
          id: v.id,
          freight: v.freight,
          stdDieselL: v.stdDieselL,
          driverAllowance: v.driverAllowance,
          podCharge: v.podCharge,
          effectiveFrom: toDateInput(v.effectiveFrom),
          effectiveTo: v.effectiveTo ? toDateInput(v.effectiveTo) : null,
        })),
      }))
      .sort((a, b) => a.origin.localeCompare(b.origin) || a.stops.join().localeCompare(b.stops.join())),
    diesel: diesel.map((r) => ({ id: r.id, ratePaise: r.ratePaise, effectiveFrom: toDateInput(r.effectiveFrom) })),
  };
}
export type MastersData = Awaited<ReturnType<typeof mastersData>>;
