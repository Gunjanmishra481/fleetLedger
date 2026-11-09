import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { parseMonth } from "@/lib/month";

export type TripFilters = {
  m: string;
  vehicle?: number;
  driver?: number | "none";
  from?: number;
  to?: number; // destination location (any stop)
  status?: string;
  dealer?: number;
  day?: string; // yyyy-mm-dd
  q?: string; // LR search
  ids?: number[]; // explicit id list (used by flagged-only and drill-downs)
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const num = (v: string | string[] | undefined) => {
  const n = Number(one(v));
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export function parseTripFilters(sp: SP): TripFilters {
  const day = one(sp.day);
  return {
    m: parseMonth(sp.m),
    vehicle: num(sp.vehicle),
    driver: one(sp.driver) === "none" ? "none" : num(sp.driver),
    from: num(sp.from),
    to: num(sp.to),
    status: ["UNBILLED", "INVOICED", "PAID"].includes(one(sp.status) ?? "") ? one(sp.status) : undefined,
    dealer: num(sp.dealer),
    day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined,
    q: one(sp.q)?.trim().toUpperCase() || undefined,
  };
}

export function tripWhere(f: TripFilters): Prisma.TripWhereInput {
  return {
    monthKey: f.m,
    ...(f.vehicle && { vehicleId: f.vehicle }),
    ...(f.driver === "none" ? { driverId: null } : f.driver ? { driverId: f.driver } : {}),
    ...(f.from && { originId: f.from }),
    ...(f.to && { stops: { some: { locationId: f.to } } }),
    ...(f.status && { billingStatus: f.status }),
    ...(f.dealer && { dealerId: f.dealer }),
    ...(f.day && { tripDate: new Date(`${f.day}T00:00:00.000Z`) }),
    ...(f.q && { lrNo: { contains: f.q } }),
    ...(f.ids && { id: { in: f.ids } }),
  };
}

export type TripRow = {
  id: number;
  serialNo: number;
  date: string; // ISO date
  vehicleId: number;
  regNo: string;
  driverId: number | null;
  driver: string | null;
  lrNo: string;
  originId: number;
  origin: string;
  destination: string;
  carsCount: number;
  dieselL: number;
  dieselRate: number;
  dieselAmount: number;
  podCharge: number;
  maintenance: number;
  driverAllowance: number;
  totalCost: number;
  freight: number;
  profit: number;
  billingStatus: string;
  dealer: string | null;
  notes: string | null;
};

export async function listTrips(f: TripFilters): Promise<TripRow[]> {
  const trips = await db.trip.findMany({
    where: tripWhere(f),
    orderBy: [{ tripDate: "asc" }, { serialNo: "asc" }, { id: "asc" }],
    include: {
      vehicle: { select: { regNo: true } },
      driver: { select: { name: true } },
      origin: { select: { name: true } },
      dealer: { select: { name: true } },
      stops: { orderBy: { seq: "asc" }, select: { location: { select: { name: true } } } },
    },
  });
  return trips.map((t) => ({
    id: t.id,
    serialNo: t.serialNo,
    date: t.tripDate.toISOString(),
    vehicleId: t.vehicleId,
    regNo: t.vehicle.regNo,
    driverId: t.driverId,
    driver: t.driver?.name ?? null,
    lrNo: t.lrNo,
    originId: t.originId,
    origin: t.origin.name,
    destination: t.stops.map((s) => s.location.name).join(" + "),
    carsCount: t.carsCount,
    dieselL: t.dieselL,
    dieselRate: t.dieselRate,
    dieselAmount: t.dieselAmount,
    podCharge: t.podCharge,
    maintenance: t.maintenance,
    driverAllowance: t.driverAllowance,
    totalCost: t.totalCost,
    freight: t.freight,
    profit: t.profit,
    billingStatus: t.billingStatus,
    dealer: t.dealer?.name ?? null,
    notes: t.notes,
  }));
}

export async function masterOptions() {
  const [vehicles, drivers, locations, dealers] = await Promise.all([
    db.vehicle.findMany({ where: { active: true }, orderBy: { regNo: "asc" }, select: { id: true, regNo: true } }),
    db.driver.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
    db.dealer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { vehicles, drivers, locations, dealers };
}
export type MasterOptions = Awaited<ReturnType<typeof masterOptions>>;
