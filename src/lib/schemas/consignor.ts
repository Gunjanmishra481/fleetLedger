import { z } from "zod";

const opt = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => (s.trim() === "" ? null : s))
    .nullable();

export const consignorSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().toUpperCase().min(2, "Short name, e.g. JKTI").max(30),
  billingName: z.string().trim().min(2, "Billing name is required").max(160),
  addressLines: z.array(z.string().max(160)).max(5).transform((a) => a.filter((l) => l.trim() !== "")),
  gstin: opt(15).refine((v) => v === null || /^\d{2}[A-Z0-9]{13}$/.test(v.trim().toUpperCase()), "GSTIN should be 15 characters"),
  pan: opt(10).refine((v) => v === null || /^[A-Z]{5}\d{4}[A-Z]$/.test(v.trim().toUpperCase()), "PAN looks wrong"),
  state: opt(40),
  stateCode: opt(3).refine((v) => v === null || /^\d{1,3}$/.test(v.trim()), "State code is 2 digits, e.g. 07"),
  handlingLabel: opt(40),
  locationIds: z.array(z.number().int().positive()).max(50),
});
export type ConsignorInput = z.input<typeof consignorSchema>;
