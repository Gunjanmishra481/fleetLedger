"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, type DbTx } from "../db";
import { requireUser } from "../session";
import { autofill, compute, monthKeyOf, nextLrNo, nextSerialNo, type Autofill } from "../services/trip";
import { parseDateOnly, tripInputSchema, type TripInput } from "@/lib/schemas/trip";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; field?: string };

const autofillSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vehicleId: z.number().int().positive().nullish(),
  originId: z.number().int().positive().nullish(),
  stopIds: z.array(z.number().int().positive()).max(3).optional(),
});

export async function getAutofill(q: z.input<typeof autofillSchema>): Promise<Autofill> {
  await requireUser();
  const p = autofillSchema.parse(q);
  return autofill(db, { ...p, date: parseDateOnly(p.date) });
}

/** Fields compared for the audit trail. */
const AUDITED = [
  "tripDate", "lrNo", "vehicleId", "driverId", "originId", "carsCount", "dieselL", "dieselRate", "podCharge",
  "maintenance", "driverAllowance", "freight", "dealerId", "billingStatus", "notes", "totalCost", "profit",
] as const;

function auditValue(v: unknown) {
  return v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? null);
}

/** Trips on an issued or paid invoice are locked: the invoice is a legal document. */
class LockedTrip extends Error {}
async function assertUnlocked(tx: DbTx, tripId: number) {
  const t = await tx.trip.findUnique({ where: { id: tripId }, select: { lrNo: true, invoice: { select: { status: true, number: true } } } });
  if (t?.invoice && (t.invoice.status === "ISSUED" || t.invoice.status === "PAID")) {
    throw new LockedTrip(`LR ${t.lrNo} is on invoice ${t.invoice.number}. Cancel that invoice first to change this trip.`);
  }
}

export async function saveTrip(raw: TripInput): Promise<Result<{ id: number }>> {
  let user: string;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "Your session has expired. Sign in again." };
  }
  const parsed = tripInputSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: i.message, field: String(i.path[0] ?? "") };
  }
  const input = parsed.data;
  const tripDate = parseDateOnly(input.tripDate);
  const money = compute(input);

  const dupe = await db.trip.findUnique({ where: { lrNo: input.lrNo }, select: { id: true } });
  if (dupe && dupe.id !== input.id) {
    return { ok: false, error: `LR ${input.lrNo} is already used by another trip`, field: "lrNo" };
  }

  const data = {
    tripDate,
    monthKey: monthKeyOf(tripDate),
    lrNo: input.lrNo,
    vehicleId: input.vehicleId,
    driverId: input.driverId,
    originId: input.originId,
    carsCount: input.carsCount,
    dieselL: input.dieselL,
    dieselRate: input.dieselRate,
    podCharge: input.podCharge,
    maintenance: input.maintenance,
    driverAllowance: input.driverAllowance,
    freight: input.freight,
    ...money,
    dealerId: input.dealerId,
    billingStatus: input.billingStatus,
    notes: input.notes || null,
    incomplete: null, // reviewed in the form; anything still empty is flagged by flags() from the data itself
  };
  const stops = input.stopIds.map((locationId, i) => ({ locationId, seq: i + 1 }));

  try {
    const id = await db.$transaction(async (tx) => {
      if (input.id) {
        await assertUnlocked(tx, input.id);
        const before = await tx.trip.findUniqueOrThrow({ where: { id: input.id }, include: { stops: true } });
        // On a draft invoice the billing status is the invoice's to set, not the form's.
        if (before.invoiceId) data.billingStatus = before.billingStatus as typeof data.billingStatus;
        const serialNo = before.monthKey === data.monthKey ? before.serialNo : await nextSerialNo(tx, data.monthKey);
        await tx.tripStop.deleteMany({ where: { tripId: input.id } });
        await tx.trip.update({ where: { id: input.id }, data: { ...data, serialNo, stops: { create: stops } } });
        const changes: Record<string, [unknown, unknown]> = {};
        for (const k of AUDITED) {
          const a = auditValue(before[k]);
          const b = auditValue(data[k]);
          if (a !== b) changes[k] = [a, b];
        }
        const oldStops = before.stops.sort((a, b) => a.seq - b.seq).map((s) => s.locationId).join(",");
        if (oldStops !== input.stopIds.join(",")) changes.stopIds = [oldStops, input.stopIds.join(",")];
        await tx.auditLog.create({
          data: { user, entity: "Trip", entityId: String(input.id), action: "UPDATE", changes: JSON.stringify(changes) },
        });
        return input.id;
      }
      const created = await tx.trip.create({
        data: { ...data, serialNo: await nextSerialNo(tx, data.monthKey), createdBy: user, stops: { create: stops } },
      });
      await tx.auditLog.create({
        data: {
          user,
          entity: "Trip",
          entityId: String(created.id),
          action: "CREATE",
          changes: JSON.stringify({ ...data, stopIds: input.stopIds, tripDate: input.tripDate }),
        },
      });
      return created.id;
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch (e) {
    // Unique constraint race on LR.
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { ok: false, error: `LR ${input.lrNo} is already used by another trip`, field: "lrNo" };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the trip" };
  }
}

const lockedResult = (e: unknown): Result<null> | null => (e instanceof LockedTrip ? { ok: false, error: e.message } : null);

export async function deleteTrip(id: number): Promise<Result<null>> {
  const user = await requireUser();
  const tripId = z.number().int().positive().parse(id);
  try {
    await db.$transaction(async (tx) => {
      await assertUnlocked(tx, tripId);
      const before = await tx.trip.findUniqueOrThrow({ where: { id: tripId } });
      await tx.trip.delete({ where: { id: tripId } });
      await tx.auditLog.create({
        data: { user, entity: "Trip", entityId: String(tripId), action: "DELETE", changes: JSON.stringify(before) },
      });
    });
  } catch (e) {
    const r = lockedResult(e);
    if (r) return r;
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

const billingSchema = z.object({ id: z.number().int().positive(), status: z.enum(["UNBILLED", "INVOICED", "PAID"]) });

export async function setBillingStatus(id: number, status: string): Promise<Result<null>> {
  const user = await requireUser();
  const p = billingSchema.safeParse({ id, status });
  if (!p.success) return { ok: false, error: "Unknown billing status" };
  const onInvoice = await db.trip.findUnique({ where: { id: p.data.id }, select: { invoice: { select: { number: true } } } });
  if (onInvoice?.invoice) return { ok: false, error: `This trip is on invoice ${onInvoice.invoice.number ?? "(draft)"}; its billing status follows the invoice.` };
  await db.$transaction(async (tx) => {
    const before = await tx.trip.findUniqueOrThrow({ where: { id: p.data.id }, select: { billingStatus: true } });
    if (before.billingStatus === p.data.status) return;
    await tx.trip.update({ where: { id: p.data.id }, data: { billingStatus: p.data.status } });
    await tx.auditLog.create({
      data: {
        user,
        entity: "Trip",
        entityId: String(p.data.id),
        action: "UPDATE",
        changes: JSON.stringify({ billingStatus: [before.billingStatus, p.data.status] }),
      },
    });
  });
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function suggestLrNo(): Promise<string> {
  await requireUser();
  return nextLrNo(db);
}
