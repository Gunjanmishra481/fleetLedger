"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { requireUser } from "../session";
import * as svc from "../services/masters";
import {
  aliasSchema,
  dealerSchema,
  dieselRateSchema,
  driverSchema,
  locationSchema,
  mergeSchema,
  rateCardSchema,
  vehicleSchema,
} from "@/lib/schemas/masters";

export type MasterResult<T = null> = { ok: true; data: T } | { ok: false; error: string; field?: string };

const idSchema = z.number().int().positive();

/** Auth + validation + friendly errors around each master write. */
async function run<S extends z.ZodTypeAny, T>(
  schema: S,
  raw: unknown,
  fn: (input: z.output<S>, user: string) => Promise<T>,
): Promise<MasterResult<T>> {
  let user: string;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "Your session has expired. Sign in again." };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: i.message, field: String(i.path[0] ?? "") };
  }
  try {
    const data = await fn(parsed.data, user);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof svc.MasterError) return { ok: false, error: e.message, field: e.field };
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return { ok: false, error: "That name is already taken" };
    console.error(e);
    return { ok: false, error: "Could not save. Please try again." };
  }
}

export const saveVehicle = async (raw: unknown) => run(vehicleSchema, raw, (i, u) => svc.saveVehicle(db, i, u));
export const saveDriver = async (raw: unknown) => run(driverSchema, raw, (i, u) => svc.saveDriver(db, i, u));
export const saveLocation = async (raw: unknown) => run(locationSchema, raw, (i, u) => svc.saveLocation(db, i, u));
export const saveDealer = async (raw: unknown) => run(dealerSchema, raw, (i, u) => svc.saveDealer(db, i, u));
export const saveRateCard = async (raw: unknown) => run(rateCardSchema, raw, (i, u) => svc.saveRateCard(db, i, u));
export const saveDieselRate = async (raw: unknown) => run(dieselRateSchema, raw, (i, u) => svc.saveDieselRate(db, i, u));

export const addDriverAlias = async (raw: unknown) => run(aliasSchema, raw, (i, u) => svc.addDriverAlias(db, i.ownerId, i.alias, u));
export const addLocationAlias = async (raw: unknown) => run(aliasSchema, raw, (i, u) => svc.addLocationAlias(db, i.ownerId, i.alias, u));
export const removeDriverAlias = async (id: unknown) => run(idSchema, id, (i, u) => svc.removeDriverAlias(db, i, u));
export const removeLocationAlias = async (id: unknown) => run(idSchema, id, (i, u) => svc.removeLocationAlias(db, i, u));

export const mergeDrivers = async (raw: unknown) => run(mergeSchema, raw, (i, u) => svc.mergeDrivers(db, i.fromId, i.intoId, u));
export const mergeLocations = async (raw: unknown) => run(mergeSchema, raw, (i, u) => svc.mergeLocations(db, i.fromId, i.intoId, u));

export const deleteDealer = async (id: unknown) => run(idSchema, id, (i, u) => svc.deleteDealer(db, i, u));
export const deleteRateCard = async (id: unknown) => run(idSchema, id, (i, u) => svc.deleteRateCard(db, i, u));
export const deleteDieselRate = async (id: unknown) => run(idSchema, id, (i, u) => svc.deleteDieselRate(db, i, u));
