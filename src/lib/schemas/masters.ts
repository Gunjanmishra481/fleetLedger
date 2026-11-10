// Shared zod schemas for the Masters screens (client validates, server validates again).
import { z } from "zod";

const id = z.number().int().positive();
const paise = z.number().int("Amount must be whole paise").min(0, "Cannot be negative").max(1e11);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null)
    .nullable();

export const vehicleSchema = z.object({
  id: id.optional(),
  regNo: z
    .string()
    .transform((s) => s.toUpperCase().replace(/[\s-]+/g, ""))
    .pipe(z.string().regex(/^[A-Z0-9]{6,12}$/, "Registration no. should be 6–12 letters/digits, e.g. NL01AL1658")),
  ownerType: z.enum(["OWN", "MARKET"]),
  model: z
    .string()
    .trim()
    .max(20)
    .transform((s) => (s ? s.toUpperCase() : null))
    .nullish(),
  usualDriverId: id.nullable(),
  active: z.boolean(),
});

export const driverSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2, "Name is too short").max(60),
  phone: optionalText(20).refine((p) => p === null || /^\+?[\d\s-]{8,16}$/.test(p), "Phone should be 8–16 digits"),
  active: z.boolean(),
});

export const locationSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2, "Name is too short").max(60),
  kind: z.enum(["LOADING_POINT", "DESTINATION"]),
  district: optionalText(60),
});

export const dealerSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2, "Name is too short").max(60),
  city: optionalText(60),
  phone: optionalText(20).refine((p) => p === null || /^\+?[\d\s-]{8,16}$/.test(p), "Phone should be 8–16 digits"),
});

export const aliasSchema = z.object({ ownerId: id, alias: z.string().trim().min(2, "Alias is too short").max(60) });
export const mergeSchema = z.object({ fromId: id, intoId: id }).refine((m) => m.fromId !== m.intoId, "Pick a different one to merge into");

export const rateCardSchema = z.object({
  originId: id,
  stopIds: z.array(id).min(1, "Pick at least one destination").max(3, "At most 3 destinations"),
  freight: paise,
  stdDieselL: z.number().min(0).max(1000),
  driverAllowance: paise,
  podCharge: paise,
  effectiveFrom: date,
});

export const dieselRateSchema = z.object({
  ratePaise: z.number().int().min(1000, "Rate looks too low").max(100000, "Rate looks too high"),
  effectiveFrom: date,
});

export type VehicleInput = z.input<typeof vehicleSchema>;
export type DriverInput = z.input<typeof driverSchema>;
export type LocationInput = z.input<typeof locationSchema>;
export type DealerInput = z.input<typeof dealerSchema>;
export type RateCardInput = z.input<typeof rateCardSchema>;
export type DieselRateInput = z.input<typeof dieselRateSchema>;
