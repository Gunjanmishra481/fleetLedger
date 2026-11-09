// Master data writes: trailers, drivers, places, dealers, rate card, diesel price.
// Every function runs in one transaction and writes an AuditLog row. Inputs are already zod-validated.
import type { Prisma } from "@prisma/client";
import type { Db, DbTx } from "../db";
import { normaliseName, normaliseRegNo } from "./import";
import { destinationKey } from "./trip";
import { parseDateOnly } from "@/lib/schemas/trip";
import type { z } from "zod";
import type {
  dealerSchema,
  dieselRateSchema,
  driverSchema,
  locationSchema,
  rateCardSchema,
  vehicleSchema,
} from "@/lib/schemas/masters";

/** A problem the person can fix (shown next to the field); anything else is a bug. */
export class MasterError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}

type Out<S extends z.ZodTypeAny> = z.output<S>;
const DAY = 86_400_000;

async function audit(tx: DbTx, user: string, entity: string, entityId: number | string, action: string, changes: unknown) {
  await tx.auditLog.create({ data: { user, entity, entityId: String(entityId), action, changes: JSON.stringify(changes) } });
}

/** { field: [old, new] } for the fields that changed. */
function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const out: Record<string, [unknown, unknown]> = {};
  for (const [k, v] of Object.entries(after)) {
    const a = before[k] instanceof Date ? (before[k] as Date).toISOString().slice(0, 10) : before[k];
    if (a !== v) out[k] = [a ?? null, v ?? null];
  }
  return out;
}

// ---------- trailers ----------

export async function saveVehicle(db: Db, input: Out<typeof vehicleSchema>, user: string) {
  const regNo = normaliseRegNo(input.regNo);
  return db.$transaction(async (tx) => {
    const clash = await tx.vehicle.findUnique({ where: { regNo } });
    if (clash && clash.id !== input.id) throw new MasterError(`${regNo} already exists`, "regNo");
    const data = { regNo, ownerType: input.ownerType, usualDriverId: input.usualDriverId, active: input.active };
    if (input.id) {
      const before = await tx.vehicle.findUniqueOrThrow({ where: { id: input.id } });
      await tx.vehicle.update({ where: { id: input.id }, data });
      await audit(tx, user, "Vehicle", input.id, "UPDATE", diff(before, data));
      return input.id;
    }
    const v = await tx.vehicle.create({ data });
    await audit(tx, user, "Vehicle", v.id, "CREATE", data);
    return v.id;
  });
}

// ---------- names shared by drivers and places ----------

async function assertDriverNameFree(tx: DbTx, name: string, exceptId?: number) {
  const d = await tx.driver.findUnique({ where: { name } });
  if (d && d.id !== exceptId) throw new MasterError(`${name} already exists`, "name");
  const a = await tx.driverAlias.findUnique({ where: { alias: name }, include: { driver: true } });
  if (a && a.driverId !== exceptId) throw new MasterError(`${name} is another spelling of ${a.driver.name}`, "name");
}

async function assertLocationNameFree(tx: DbTx, name: string, exceptId?: number) {
  const l = await tx.location.findUnique({ where: { name } });
  if (l && l.id !== exceptId) throw new MasterError(`${name} already exists`, "name");
  const a = await tx.locationAlias.findUnique({ where: { alias: name }, include: { location: true } });
  if (a && a.locationId !== exceptId) throw new MasterError(`${name} is another spelling of ${a.location.name}`, "name");
}

// ---------- drivers ----------

export async function saveDriver(db: Db, input: Out<typeof driverSchema>, user: string) {
  const name = normaliseName(input.name);
  return db.$transaction(async (tx) => {
    await assertDriverNameFree(tx, name, input.id);
    const data = { name, phone: input.phone, active: input.active };
    if (input.id) {
      const before = await tx.driver.findUniqueOrThrow({ where: { id: input.id } });
      await tx.driver.update({ where: { id: input.id }, data });
      // An alias equal to the new name is now redundant.
      await tx.driverAlias.deleteMany({ where: { driverId: input.id, alias: name } });
      await audit(tx, user, "Driver", input.id, "UPDATE", diff(before, data));
      return input.id;
    }
    const d = await tx.driver.create({ data });
    await audit(tx, user, "Driver", d.id, "CREATE", data);
    return d.id;
  });
}

export async function addDriverAlias(db: Db, driverId: number, rawAlias: string, user: string) {
  const alias = normaliseName(rawAlias);
  return db.$transaction(async (tx) => {
    await assertDriverNameFree(tx, alias);
    await tx.driverAlias.create({ data: { alias, driverId } });
    await audit(tx, user, "Driver", driverId, "ALIAS_ADD", { alias });
  });
}

export async function removeDriverAlias(db: Db, aliasId: number, user: string) {
  return db.$transaction(async (tx) => {
    const a = await tx.driverAlias.delete({ where: { id: aliasId } });
    await audit(tx, user, "Driver", a.driverId, "ALIAS_REMOVE", { alias: a.alias });
  });
}

/** Moves every trip, trailer link and alias from one driver to another; the old name becomes an alias. */
export async function mergeDrivers(db: Db, fromId: number, intoId: number, user: string) {
  return db.$transaction(async (tx) => {
    const [from, into] = await Promise.all([
      tx.driver.findUniqueOrThrow({ where: { id: fromId } }),
      tx.driver.findUniqueOrThrow({ where: { id: intoId } }),
    ]);
    const trips = await tx.trip.updateMany({ where: { driverId: fromId }, data: { driverId: intoId } });
    await tx.vehicle.updateMany({ where: { usualDriverId: fromId }, data: { usualDriverId: intoId } });
    await tx.driverAlias.updateMany({ where: { driverId: fromId }, data: { driverId: intoId } });
    await tx.driver.delete({ where: { id: fromId } });
    await tx.driverAlias.upsert({ where: { alias: from.name }, create: { alias: from.name, driverId: intoId }, update: { driverId: intoId } });
    await audit(tx, user, "Driver", intoId, "MERGE", { merged: from.name, into: into.name, tripsMoved: trips.count });
    return { tripsMoved: trips.count };
  });
}

// ---------- places ----------

export async function saveLocation(db: Db, input: Out<typeof locationSchema>, user: string) {
  const name = normaliseName(input.name);
  return db.$transaction(async (tx) => {
    await assertLocationNameFree(tx, name, input.id);
    const data = { name, kind: input.kind, district: input.district ? normaliseName(input.district) : null };
    if (input.id) {
      const before = await tx.location.findUniqueOrThrow({ where: { id: input.id } });
      await tx.location.update({ where: { id: input.id }, data });
      await tx.locationAlias.deleteMany({ where: { locationId: input.id, alias: name } });
      await audit(tx, user, "Location", input.id, "UPDATE", diff(before, data));
      return input.id;
    }
    const l = await tx.location.create({ data });
    await audit(tx, user, "Location", l.id, "CREATE", data);
    return l.id;
  });
}

export async function addLocationAlias(db: Db, locationId: number, rawAlias: string, user: string) {
  const alias = normaliseName(rawAlias);
  return db.$transaction(async (tx) => {
    await assertLocationNameFree(tx, alias);
    await tx.locationAlias.create({ data: { alias, locationId } });
    await audit(tx, user, "Location", locationId, "ALIAS_ADD", { alias });
  });
}

export async function removeLocationAlias(db: Db, aliasId: number, user: string) {
  return db.$transaction(async (tx) => {
    const a = await tx.locationAlias.delete({ where: { id: aliasId } });
    await audit(tx, user, "Location", a.locationId, "ALIAS_REMOVE", { alias: a.alias });
  });
}

/**
 * Merges one place into another: trip origins and stops, rate cards and aliases move over,
 * and the old name becomes an alias. A trip that already stops at both keeps one stop.
 * A moved rate card that collides with an existing one for the same route and date is dropped
 * (the existing card wins).
 */
export async function mergeLocations(db: Db, fromId: number, intoId: number, user: string) {
  return db.$transaction(
    async (tx) => {
      const [from, into] = await Promise.all([
        tx.location.findUniqueOrThrow({ where: { id: fromId } }),
        tx.location.findUniqueOrThrow({ where: { id: intoId } }),
      ]);
      const origins = await tx.trip.updateMany({ where: { originId: fromId }, data: { originId: intoId } });

      // Stops: re-point, dropping duplicates, then renumber 1..n.
      const affected = await tx.tripStop.findMany({ where: { locationId: fromId }, select: { tripId: true } });
      for (const tripId of new Set(affected.map((s) => s.tripId))) {
        const stops = await tx.tripStop.findMany({ where: { tripId }, orderBy: { seq: "asc" } });
        const seen = new Set<number>();
        const keep: number[] = [];
        for (const s of stops) {
          const loc = s.locationId === fromId ? intoId : s.locationId;
          if (!seen.has(loc)) {
            seen.add(loc);
            keep.push(loc);
          }
        }
        await tx.tripStop.deleteMany({ where: { tripId } });
        await tx.tripStop.createMany({ data: keep.map((locationId, i) => ({ tripId, locationId, seq: i + 1 })) });
      }

      // Rate cards that mention the old place.
      const cards = await tx.rateCard.findMany();
      let cardsMoved = 0;
      let cardsDropped = 0;
      const touched = new Set<string>();
      for (const c of cards) {
        const ids = c.destinationKey.split("-").map(Number);
        if (c.originId !== fromId && !ids.includes(fromId)) continue;
        const originId = c.originId === fromId ? intoId : c.originId;
        const key = destinationKey(ids.map((x) => (x === fromId ? intoId : x)));
        const clash = await tx.rateCard.findFirst({
          where: { originId, destinationKey: key, effectiveFrom: c.effectiveFrom, NOT: { id: c.id } },
        });
        if (clash) {
          await tx.rateCard.delete({ where: { id: c.id } });
          cardsDropped++;
        } else {
          await tx.rateCard.update({ where: { id: c.id }, data: { originId, destinationKey: key } });
          cardsMoved++;
        }
        touched.add(`${originId}|${key}`);
      }
      for (const t of touched) {
        const [o, k] = t.split("|");
        await relinkRateCards(tx, Number(o), k);
      }

      await tx.locationAlias.updateMany({ where: { locationId: fromId }, data: { locationId: intoId } });
      await tx.location.delete({ where: { id: fromId } });
      await tx.locationAlias.upsert({ where: { alias: from.name }, create: { alias: from.name, locationId: intoId }, update: { locationId: intoId } });
      const summary = { merged: from.name, into: into.name, originsMoved: origins.count, tripsWithStops: affected.length, cardsMoved, cardsDropped };
      await audit(tx, user, "Location", intoId, "MERGE", summary);
      return summary;
    },
    { timeout: 60_000 },
  );
}

// ---------- dealers ----------

export async function saveDealer(db: Db, input: Out<typeof dealerSchema>, user: string) {
  const name = normaliseName(input.name);
  return db.$transaction(async (tx) => {
    const clash = await tx.dealer.findUnique({ where: { name } });
    if (clash && clash.id !== input.id) throw new MasterError(`${name} already exists`, "name");
    const data = { name, city: input.city ? normaliseName(input.city) : null, phone: input.phone };
    if (input.id) {
      const before = await tx.dealer.findUniqueOrThrow({ where: { id: input.id } });
      await tx.dealer.update({ where: { id: input.id }, data });
      await audit(tx, user, "Dealer", input.id, "UPDATE", diff(before, data));
      return input.id;
    }
    const d = await tx.dealer.create({ data });
    await audit(tx, user, "Dealer", d.id, "CREATE", data);
    return d.id;
  });
}

export async function deleteDealer(db: Db, id: number, user: string) {
  return db.$transaction(async (tx) => {
    const used = await tx.trip.count({ where: { dealerId: id } });
    if (used) throw new MasterError(`This dealer is on ${used} trip(s), so it can't be deleted`);
    const d = await tx.dealer.delete({ where: { id } });
    await audit(tx, user, "Dealer", id, "DELETE", d);
  });
}

// ---------- rate card (versions by effective date) ----------

/** Re-links a route's versions so each ends the day before the next starts; the newest stays open. */
async function relinkRateCards(tx: DbTx, originId: number, key: string) {
  const versions = await tx.rateCard.findMany({ where: { originId, destinationKey: key }, orderBy: { effectiveFrom: "asc" } });
  for (let i = 0; i < versions.length; i++) {
    const next = versions[i + 1];
    const effectiveTo = next ? new Date(next.effectiveFrom.getTime() - DAY) : null;
    if ((versions[i].effectiveTo?.getTime() ?? null) !== (effectiveTo?.getTime() ?? null)) {
      await tx.rateCard.update({ where: { id: versions[i].id }, data: { effectiveTo } });
    }
  }
}

/**
 * Saves a rate for a route from a date. Same route + same date updates that version;
 * a new date adds a version. Existing trips keep the amounts they were saved with.
 */
export async function saveRateCard(db: Db, input: Out<typeof rateCardSchema>, user: string) {
  const key = destinationKey(input.stopIds);
  const effectiveFrom = parseDateOnly(input.effectiveFrom);
  const values = {
    freight: input.freight,
    stdDieselL: input.stdDieselL,
    driverAllowance: input.driverAllowance,
    podCharge: input.podCharge,
  };
  return db.$transaction(async (tx) => {
    const origin = await tx.location.findUniqueOrThrow({ where: { id: input.originId } });
    if (input.stopIds.includes(input.originId)) throw new MasterError("A destination can't be the loading point", "stopIds");
    const where: Prisma.RateCardWhereUniqueInput = {
      originId_destinationKey_effectiveFrom: { originId: input.originId, destinationKey: key, effectiveFrom },
    };
    const existing = await tx.rateCard.findUnique({ where });
    let id: number;
    if (existing) {
      await tx.rateCard.update({ where: { id: existing.id }, data: values });
      await audit(tx, user, "RateCard", existing.id, "UPDATE", diff(existing, values));
      id = existing.id;
    } else {
      const c = await tx.rateCard.create({ data: { originId: input.originId, destinationKey: key, effectiveFrom, ...values } });
      await audit(tx, user, "RateCard", c.id, "CREATE", { origin: origin.name, destinationKey: key, effectiveFrom: input.effectiveFrom, ...values });
      id = c.id;
    }
    await relinkRateCards(tx, input.originId, key);
    return id;
  });
}

export async function deleteRateCard(db: Db, id: number, user: string) {
  return db.$transaction(async (tx) => {
    const c = await tx.rateCard.delete({ where: { id } });
    await relinkRateCards(tx, c.originId, c.destinationKey);
    await audit(tx, user, "RateCard", id, "DELETE", c);
  });
}

// ---------- diesel price ----------

/** Sets the diesel price from a date (same date = correction). Only trips entered afterwards pick it up. */
export async function saveDieselRate(db: Db, input: Out<typeof dieselRateSchema>, user: string) {
  const effectiveFrom = parseDateOnly(input.effectiveFrom);
  return db.$transaction(async (tx) => {
    const before = await tx.dieselRate.findUnique({ where: { effectiveFrom } });
    const r = await tx.dieselRate.upsert({
      where: { effectiveFrom },
      create: { effectiveFrom, ratePaise: input.ratePaise },
      update: { ratePaise: input.ratePaise },
    });
    await audit(tx, user, "DieselRate", r.id, before ? "UPDATE" : "CREATE", {
      effectiveFrom: input.effectiveFrom,
      ratePaise: before ? [before.ratePaise, input.ratePaise] : input.ratePaise,
    });
    return r.id;
  });
}

export async function deleteDieselRate(db: Db, id: number, user: string) {
  return db.$transaction(async (tx) => {
    if ((await tx.dieselRate.count()) <= 1) throw new MasterError("Keep at least one diesel price");
    const r = await tx.dieselRate.delete({ where: { id } });
    await audit(tx, user, "DieselRate", id, "DELETE", r);
  });
}
