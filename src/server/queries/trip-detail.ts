import { db } from "../db";
import { monthFlags } from "../services/summary";

const MONEY = new Set(["dieselRate", "podCharge", "maintenance", "driverAllowance", "freight", "totalCost", "profit", "dieselAmount"]);
const LABEL: Record<string, string> = {
  tripDate: "Date", lrNo: "LR", vehicleId: "Trailer", driverId: "Driver", originId: "From", stopIds: "Destinations",
  carsCount: "Cars", dieselL: "Diesel L", dieselRate: "Diesel rate", podCharge: "POD", maintenance: "Maintenance",
  driverAllowance: "Allowance", freight: "Freight", dealerId: "Dealer", billingStatus: "Billing", notes: "Note",
  totalCost: "Total cost", profit: "Profit",
};

export type AuditChange = { field: string; label: string; from: string; to: string; money: boolean; fromN?: number; toN?: number };
export type AuditEntry = { id: number; at: string; user: string; action: string; changes: AuditChange[] };

export async function tripDetail(id: number) {
  const t = await db.trip.findUnique({
    where: { id },
    include: {
      vehicle: { select: { id: true, regNo: true } },
      driver: { select: { id: true, name: true, phone: true } },
      origin: { select: { id: true, name: true } },
      dealer: { select: { name: true } },
      stops: { orderBy: { seq: "asc" }, select: { location: { select: { id: true, name: true } } } },
    },
  });
  if (!t) return null;
  const [flagMap, logs, vehicles, drivers, locations, dealers] = await Promise.all([
    monthFlags(t.monthKey),
    db.auditLog.findMany({ where: { entity: "Trip", entityId: String(id) }, orderBy: { at: "desc" }, take: 50 }),
    db.vehicle.findMany({ select: { id: true, regNo: true } }),
    db.driver.findMany({ select: { id: true, name: true } }),
    db.location.findMany({ select: { id: true, name: true } }),
    db.dealer.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = (field: string, v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (field === "vehicleId") return vehicles.find((x) => x.id === n)?.regNo ?? String(v);
    if (field === "driverId") return drivers.find((x) => x.id === n)?.name ?? String(v);
    if (field === "originId") return locations.find((x) => x.id === n)?.name ?? String(v);
    if (field === "dealerId") return dealers.find((x) => x.id === n)?.name ?? String(v);
    if (field === "stopIds")
      return String(v)
        .split(",")
        .map((s) => locations.find((x) => x.id === Number(s))?.name ?? s)
        .join(" + ");
    return String(v);
  };

  const audit: AuditEntry[] = logs.map((l) => {
    let changes: AuditChange[] = [];
    try {
      const parsed = JSON.parse(l.changes) as Record<string, unknown>;
      if (l.action === "UPDATE") {
        changes = Object.entries(parsed as Record<string, [unknown, unknown]>).map(([field, [a, b]]) => ({
          field,
          label: LABEL[field] ?? field,
          from: nameOf(field, a),
          to: nameOf(field, b),
          money: MONEY.has(field),
          fromN: typeof a === "number" ? a : undefined,
          toN: typeof b === "number" ? b : undefined,
        }));
      }
    } catch {
      /* unreadable entry: show the action only */
    }
    return { id: l.id, at: l.at.toISOString(), user: l.user, action: l.action, changes };
  });

  return {
    id: t.id,
    serialNo: t.serialNo,
    date: t.tripDate.toISOString(),
    monthKey: t.monthKey,
    lrNo: t.lrNo,
    vehicle: t.vehicle,
    driver: t.driver,
    origin: t.origin.name,
    stops: t.stops.map((s) => s.location.name),
    stopIds: t.stops.map((s) => s.location.id),
    originId: t.origin.id,
    carsCount: t.carsCount,
    dieselL: t.dieselL,
    dieselRate: t.dieselRate,
    dieselAmount: t.dieselAmount,
    podCharge: t.podCharge,
    maintenance: t.maintenance,
    driverAllowance: t.driverAllowance,
    freight: t.freight,
    totalCost: t.totalCost,
    profit: t.profit,
    dealer: t.dealer?.name ?? null,
    billingStatus: t.billingStatus as "UNBILLED" | "INVOICED" | "PAID",
    notes: t.notes,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    flags: flagMap.get(t.id) ?? [],
    audit,
  };
}
export type TripDetailData = NonNullable<Awaited<ReturnType<typeof tripDetail>>>;
