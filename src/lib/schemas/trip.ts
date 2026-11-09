// Shared trip schema: the form validates with it before sending, the server action validates again.
import { z } from "zod";

const paise = z.number().int("Amount must be whole paise").min(0, "Cannot be negative").max(1e11);
const id = z.number().int().positive();

export const BILLING_STATUSES = ["UNBILLED", "INVOICED", "PAID"] as const;

export const tripInputSchema = z.object({
  id: id.optional(),
  tripDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  lrNo: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/\s+/g, ""))
    .pipe(z.string().min(1, "LR number is required").max(20).regex(/^[0-9A-Z-]+$/, "LR may only contain digits, letters and -")),
  vehicleId: id,
  driverId: id,
  originId: id,
  stopIds: z.array(id).min(1, "Pick at least one destination").max(3, "At most 3 destinations"),
  carsCount: z.number().int().min(1, "At least 1 car").max(12, "At most 12 cars"),
  dieselL: z.number().min(0).max(1000),
  dieselRate: paise,
  podCharge: paise,
  maintenance: paise,
  driverAllowance: paise,
  freight: paise,
  dealerId: id.nullable(),
  billingStatus: z.enum(BILLING_STATUSES),
  notes: z.string().trim().max(500).nullable(),
});

export type TripInput = z.infer<typeof tripInputSchema>;

/** UTC-midnight Date for a yyyy-mm-dd string. */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}
