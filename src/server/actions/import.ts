"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { requireUser } from "../session";
import { analyse, commitImport, readSheet, type Issue, type Preview } from "../services/import";

export type ImportSummary = {
  sheetName: string;
  months: string[];
  totals: Preview["totals"];
  issues: Issue[];
  newDrivers: string[];
  newVehicles: string[];
  newLocations: Preview["newLocations"];
  newDealers: string[];
  hasErrors: boolean; // rows that can't be imported at all (no usable date); the rest still import
  incompleteTrips: number;
  lrClash: boolean;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const fileSchema = z
  .instanceof(File, { message: "Choose an .xlsx file" })
  .refine((f) => f.size > 0, "The file is empty")
  .refine((f) => f.size < 5 * 1024 * 1024, "File is larger than 5 MB")
  .refine((f) => /\.xlsx$/i.test(f.name), "Only .xlsx files are supported");

async function load(formData: FormData) {
  const file = fileSchema.parse(formData.get("file"));
  const sheetName = z.string().trim().optional().parse(formData.get("sheet") || undefined);
  return analyse(db, await readSheet(await file.arrayBuffer(), sheetName));
}

function message(e: unknown) {
  if (e instanceof z.ZodError) return e.issues.map((i) => i.message).join("; ");
  return e instanceof Error ? e.message : String(e);
}

export async function previewImport(formData: FormData): Promise<Result<ImportSummary>> {
  try {
    await requireUser();
    const p = await load(formData);
    return {
      ok: true,
      data: {
        sheetName: p.sheetName,
        months: p.months,
        totals: p.totals,
        issues: p.issues,
        newDrivers: p.newDrivers,
        newVehicles: p.newVehicles,
        newLocations: p.newLocations,
        newDealers: p.newDealers,
        hasErrors: p.issues.some((i) => i.kind === "ERROR"),
        incompleteTrips: p.trips.filter((t) => t.incomplete.length).length,
        lrClash: p.issues.some((i) => i.kind === "LR_EXISTS"),
      },
    };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function runImport(
  formData: FormData,
): Promise<Result<{ tripsCreated: number; deletedTrips: number; rateCardsCreated: number; months: string[]; incompleteTrips: number }>> {
  try {
    const user = await requireUser();
    const replaceMonths = formData.get("replace") === "on";
    const p = await load(formData);
    const r = await commitImport(db, p, { user, replaceMonths }); // writes its own AuditLog row
    revalidatePath("/", "layout");
    return { ok: true, data: { ...r, months: p.months, incompleteTrips: p.trips.filter((t) => t.incomplete.length).length } };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
