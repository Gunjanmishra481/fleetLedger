"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { requireUser } from "../session";
import type { VinRow } from "../invoice/reference";
import type { VinMatchReport } from "../invoice/vins";
import {
  InvoiceError,
  cancelInvoice,
  checkVins,
  deleteDraft,
  issueInvoice,
  markPaid,
  nextInvoiceNo,
  parseVinText,
  parseVinWorkbook,
  saveDraft,
} from "../services/invoice";
import { parseDateOnly } from "@/lib/schemas/trip";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof InvoiceError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the details" };
  if (e && typeof e === "object" && "code" in e && e.code === "P2002") return { ok: false, error: "That invoice number is already used" };
  console.error(e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const ids = z.array(z.number().int().positive()).min(1, "Pick at least one trip").max(500);
const vinRow = z.object({
  vin: z.string().min(1).max(40),
  model: z.string().nullable(), oem: z.string().nullable(), region: z.string().nullable(), dealerCode: z.string().nullable(),
  dealerName: z.string().nullable(), dealerLocation: z.string().nullable(), oemInvoiceDate: z.string().nullable(), oemInvoiceNo: z.string().nullable(),
  lotNo: z.string().nullable(), loafNo: z.string().nullable(), lastMileTpt: z.string().nullable(), carrierNo: z.string().nullable(),
  dispatchDate: z.coerce.date().nullable(), lrNo: z.string().nullable(),
});
const invoiceSchema = z.object({
  consignorId: z.number().int().positive(),
  tripIds: ids,
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the invoice date"),
  number: z.string().trim().max(30).regex(/^[A-Za-z0-9/-]*$/, "Invoice number: letters, digits, / and - only").nullish(),
  vinRows: z.array(vinRow).max(5000).nullish(),
  draftId: z.number().int().positive().nullish(),
});

/** Parses the client's VIN sheet (upload or paste) and matches it to the selected trips. */
export async function checkVinSheet(formData: FormData): Promise<Result<{ rows: VinRow[]; report: VinMatchReport }>> {
  try {
    await requireUser();
    const tripIds = ids.parse(JSON.parse(String(formData.get("tripIds") ?? "[]")));
    const file = formData.get("file");
    const text = String(formData.get("text") ?? "");
    let rows: VinRow[] = [];
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) return { ok: false, error: "The VIN sheet is larger than 5 MB" };
      rows = await parseVinWorkbook(await file.arrayBuffer());
    } else if (text.trim()) {
      rows = parseVinText(text);
    } else {
      return { ok: false, error: "Upload the client's VIN sheet or paste its rows" };
    }
    if (!rows.length) return { ok: false, error: 'No VIN rows found. The sheet needs a "VIN NO" column (or paste rows in the VIN DETAILS order).' };
    return { ok: true, data: { rows, report: await checkVins(db, tripIds, rows) } };
  } catch (e) {
    return fail(e);
  }
}

export async function suggestInvoiceNumber(date: string): Promise<string> {
  await requireUser();
  return (await nextInvoiceNo(db, parseDateOnly(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(date)))).number;
}

export async function saveInvoiceDraft(raw: unknown): Promise<Result<{ id: number }>> {
  try {
    const user = await requireUser();
    const p = invoiceSchema.parse(raw);
    const id = await saveDraft(db, { ...p, invoiceDate: parseDateOnly(p.invoiceDate), vinRows: p.vinRows ?? null }, user);
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

export async function issueInvoiceAction(raw: unknown): Promise<Result<{ id: number; number: string }>> {
  try {
    const user = await requireUser();
    const p = invoiceSchema.parse(raw);
    const r = await issueInvoice(db, { ...p, invoiceDate: parseDateOnly(p.invoiceDate), number: p.number || null, vinRows: p.vinRows ?? null }, user);
    revalidatePath("/", "layout");
    return { ok: true, data: r };
  } catch (e) {
    return fail(e);
  }
}

const idSchema = z.number().int().positive();

export async function markInvoicePaid(id: number, paidOn?: string): Promise<Result> {
  try {
    const user = await requireUser();
    await markPaid(db, idSchema.parse(id), user, paidOn ? parseDateOnly(paidOn) : new Date());
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelInvoiceAction(id: number, reason?: string): Promise<Result> {
  try {
    const user = await requireUser();
    await cancelInvoice(db, idSchema.parse(id), user, z.string().max(200).optional().parse(reason));
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteInvoiceDraft(id: number): Promise<Result> {
  try {
    const user = await requireUser();
    await deleteDraft(db, idSchema.parse(id), user);
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
