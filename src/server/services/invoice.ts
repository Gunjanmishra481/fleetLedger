// Invoices: numbering, totals, VIN matching, issue / paid / cancel, and the Excel document.
// Pure maths lives in ../invoice/maths.ts; the workbook builder in ../invoice/xlsx.ts.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Db, DbTx } from "../db";
import { COMPANY } from "@/config/company";
import { fyCode, fyPeriod } from "@/lib/fy";
import { computeInvoice, type InvoiceTotals } from "../invoice/maths";
import { formatDmy, parseInvoiceNumber, type BuyerDetails, type InvoiceLine, type VinRow } from "../invoice/reference";
import { matchVins, type MatchTrip, type VinMatchReport } from "../invoice/vins";
import { buildInvoiceXlsx, type InvoiceDocument, type SellerSnapshot } from "../invoice/xlsx";

export { amountInWords, computeInvoice } from "../invoice/maths";
export { parseVinText, parseVinWorkbook, matchVins } from "../invoice/vins";
export { buildInvoiceXlsx } from "../invoice/xlsx";
export type { InvoiceDocument } from "../invoice/xlsx";

export class InvoiceError extends Error {}

export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// ---------- numbering ----------

/**
 * Next number for the FY containing `date`: prefix + FY code + running number. The running
 * number is one more than the highest used in that FY, but never below the FY's start number
 * in InvoiceSeries (2627 starts at 109, continuing after MKLAMD2627108).
 */
export async function nextInvoiceNo(db: DbTx, date: Date): Promise<{ number: string; fy: string; seq: number }> {
  const fy = fyCode(date);
  const [agg, series] = await Promise.all([
    db.invoice.aggregate({ where: { fy }, _max: { seq: true } }),
    db.invoiceSeries.findUnique({ where: { fy } }),
  ]);
  const seq = Math.max((agg._max.seq ?? 0) + 1, series?.startNo ?? 1);
  return { number: `${COMPANY.invoicePrefix}${fy}${seq}`, fy, seq };
}

export function sellerSnapshot(): SellerSnapshot {
  return {
    name: COMPANY.name,
    addressLines: [...COMPANY.addressLines],
    phone: COMPANY.phone,
    contactNo: COMPANY.contactNo,
    pan: COMPANY.pan,
    gstin: COMPANY.gstin,
    stateCode: COMPANY.stateCode,
    sacCode: COMPANY.sacCode,
    bank: { ...COMPANY.bank },
  };
}

export function buyerSnapshot(c: {
  billingName: string;
  addressLines: string[];
  gstin: string | null;
  pan: string | null;
  state: string | null;
  stateCode: string | null;
  handlingLabel: string | null;
}): BuyerDetails {
  return { billingName: c.billingName, addressLines: c.addressLines, gstin: c.gstin, pan: c.pan, state: c.state, stateCode: c.stateCode, handlingLabel: c.handlingLabel };
}

// ---------- lines from trips ----------

const tripInclude = {
  vehicle: { select: { regNo: true, model: true } },
  origin: { select: { consignorId: true } },
  stops: { orderBy: { seq: "asc" as const }, select: { location: { select: { name: true } } } },
  vins: { orderBy: { seq: "asc" as const } },
};

type TripForInvoice = Awaited<ReturnType<typeof loadTrips>>[number];

async function loadTrips(db: DbTx, tripIds: number[]) {
  const trips = await db.trip.findMany({ where: { id: { in: tripIds } }, include: tripInclude });
  // Invoice order: dispatch date, then LR (numeric where possible).
  return trips.sort(
    (a, b) => a.tripDate.getTime() - b.tripDate.getTime() || (Number(a.lrNo) || 0) - (Number(b.lrNo) || 0) || a.lrNo.localeCompare(b.lrNo),
  );
}

export function lineFor(t: TripForInvoice, handlingLabel: string | null): InvoiceLine {
  return {
    carrierNo: t.vehicle?.regNo ?? "",
    model: t.vehicle?.model ?? null,
    lrNo: t.lrNo,
    vins: t.vins.length || t.carsCount,
    handling: handlingLabel,
    delivery: t.stops.map((s) => s.location.name).join(" + "),
    tptr: COMPANY.transporterShortName,
    dispDate: t.tripDate,
    amount: t.freight,
  };
}

function vinRowFor(v: TripForInvoice["vins"][number], lrNo: string): VinRow {
  return {
    vin: v.vin,
    model: v.model,
    oem: v.oem,
    region: v.region,
    dealerCode: v.dealerCode,
    dealerName: v.dealerName,
    dealerLocation: v.dealerLocation,
    oemInvoiceDate: v.oemInvoiceDate,
    oemInvoiceNo: v.oemInvoiceNo,
    lotNo: v.lotNo,
    loafNo: v.loafNo,
    lastMileTpt: v.lastMileTpt,
    carrierNo: v.carrierNo,
    dispatchDate: v.dispatchDate,
    lrNo,
  };
}

// ---------- VINs ----------

/** Matches parsed VIN rows to the given trips, also checking VINs already recorded elsewhere. */
export async function checkVins(db: DbTx, tripIds: number[], rows: VinRow[]): Promise<VinMatchReport> {
  const trips = await db.trip.findMany({ where: { id: { in: tripIds } }, select: { id: true, lrNo: true, carsCount: true, vehicle: { select: { regNo: true } } } });
  const existing = await db.tripVin.findMany({
    where: { vin: { in: rows.map((r) => r.vin) } },
    select: { vin: true, tripId: true, trip: { select: { lrNo: true } } },
  });
  const mt: MatchTrip[] = trips.map((t) => ({ id: t.id, lrNo: t.lrNo, regNo: t.vehicle?.regNo ?? null, carsCount: t.carsCount }));
  return matchVins(mt, rows, new Map(existing.map((e) => [e.vin, { tripId: e.tripId, lrNo: e.trip.lrNo }])));
}

/** Replaces the VINs of the matched trips with the sheet's rows (in sheet order). */
async function attachVins(tx: DbTx, report: VinMatchReport) {
  for (const t of report.trips) {
    if (!t.vins.length) continue;
    await tx.tripVin.deleteMany({ where: { tripId: t.tripId } });
    // A VIN recorded on another trip moves to this one (the latest sheet wins); duplicates keep the first row.
    const seen = new Set<string>();
    const rows = t.vins.filter((v) => (seen.has(v.vin) ? false : (seen.add(v.vin), true)));
    await tx.tripVin.deleteMany({ where: { vin: { in: rows.map((v) => v.vin) } } });
    await tx.tripVin.createMany({
      data: rows.map((v, i) => ({
        tripId: t.tripId,
        seq: i + 1,
        vin: v.vin,
        model: v.model,
        oem: v.oem,
        region: v.region,
        dealerCode: v.dealerCode,
        dealerName: v.dealerName,
        dealerLocation: v.dealerLocation,
        oemInvoiceDate: v.oemInvoiceDate,
        oemInvoiceNo: v.oemInvoiceNo,
        lotNo: v.lotNo,
        loafNo: v.loafNo,
        lastMileTpt: v.lastMileTpt,
        carrierNo: v.carrierNo,
        dispatchDate: v.dispatchDate,
      })),
    });
  }
}

// ---------- draft / issue / paid / cancel ----------

export type InvoiceRequest = {
  consignorId: number;
  tripIds: number[];
  invoiceDate: Date;
  number?: string | null; // omit for the next number in the series
  vinRows?: VinRow[] | null; // the client's VIN sheet, if uploaded
  draftId?: number | null; // turning a draft into an issued invoice
};

async function audit(tx: DbTx, user: string, id: number, action: string, changes: unknown) {
  await tx.auditLog.create({ data: { user, entity: "Invoice", entityId: String(id), action, changes: JSON.stringify(changes) } });
}

/** Trips must belong to the client, be unbilled, and not be on another invoice. */
async function assertBillable(tx: DbTx, consignorId: number, tripIds: number[], draftId: number | null) {
  if (!tripIds.length) throw new InvoiceError("Pick at least one trip");
  const trips = await tx.trip.findMany({
    where: { id: { in: tripIds } },
    select: { id: true, lrNo: true, billingStatus: true, invoiceId: true, origin: { select: { consignorId: true } } },
  });
  if (trips.length !== new Set(tripIds).size) throw new InvoiceError("Some trips no longer exist");
  for (const t of trips) {
    if (t.origin?.consignorId !== consignorId) throw new InvoiceError(`LR ${t.lrNo} is not loaded for this client`);
    if (t.invoiceId && t.invoiceId !== draftId) throw new InvoiceError(`LR ${t.lrNo} is already on another invoice`);
    if (t.billingStatus !== "UNBILLED") throw new InvoiceError(`LR ${t.lrNo} is already ${t.billingStatus.toLowerCase()}`);
  }
}

async function totalsFor(tx: DbTx, consignorId: number, tripIds: number[]) {
  const client = await tx.consignor.findUniqueOrThrow({ where: { id: consignorId } });
  const trips = await loadTrips(tx, tripIds);
  const totals = computeInvoice({ amounts: trips.map((t) => t.freight), sellerStateCode: COMPANY.stateCodeForGst, buyerStateCode: client.stateCode });
  return { client, trips, totals };
}

/** Saves (or updates) a draft: the trips are held for this invoice but stay unbilled and editable. */
export async function saveDraft(db: Db, req: InvoiceRequest, user: string): Promise<number> {
  return db.$transaction(async (tx) => {
    await assertBillable(tx, req.consignorId, req.tripIds, req.draftId ?? null);
    if (req.vinRows?.length) await attachVins(tx, await checkVins(tx, req.tripIds, req.vinRows));
    const { totals } = await totalsFor(tx, req.consignorId, req.tripIds);
    const data = {
      consignorId: req.consignorId,
      invoiceDate: req.invoiceDate,
      period: fyPeriod(req.invoiceDate),
      placeOfSupply: COMPANY.placeOfSupply,
      ...money(totals),
      status: "DRAFT",
    };
    let id: number;
    if (req.draftId) {
      const d = await tx.invoice.findUniqueOrThrow({ where: { id: req.draftId } });
      if (d.status !== "DRAFT") throw new InvoiceError("Only drafts can be changed");
      await tx.trip.updateMany({ where: { invoiceId: d.id, id: { notIn: req.tripIds } }, data: { invoiceId: null } });
      await tx.invoice.update({ where: { id: d.id }, data });
      id = d.id;
    } else {
      id = (await tx.invoice.create({ data: { ...data, createdBy: user } })).id;
    }
    await tx.trip.updateMany({ where: { id: { in: req.tripIds } }, data: { invoiceId: id } });
    await audit(tx, user, id, req.draftId ? "UPDATE" : "DRAFT", { trips: req.tripIds.length, total: totals.total });
    return id;
  }, { timeout: 60_000 });
}

function money(t: InvoiceTotals) {
  return { subtotal: t.subtotal, igst: t.igst, cgst: t.cgst, sgst: t.sgst, roundOff: t.roundOff, total: t.total };
}

/**
 * Issues an invoice: attaches the client's VINs, freezes seller/buyer/lines/VINs, assigns the
 * number, and locks the trips (billing INVOICED, invoiceId set). One transaction, one audit row.
 */
export async function issueInvoice(db: Db, req: InvoiceRequest, user: string): Promise<{ id: number; number: string }> {
  return db.$transaction(async (tx) => {
    await assertBillable(tx, req.consignorId, req.tripIds, req.draftId ?? null);
    let vinReport: VinMatchReport | null = null;
    if (req.vinRows?.length) {
      vinReport = await checkVins(tx, req.tripIds, req.vinRows);
      await attachVins(tx, vinReport);
    }
    const { client, trips, totals } = await totalsFor(tx, req.consignorId, req.tripIds);

    let number: string, fy: string | null, seq: number | null;
    if (req.number?.trim()) {
      number = req.number.trim().toUpperCase().replace(/\s+/g, "");
      const p = parseInvoiceNumber(number);
      const follows = p && number.startsWith(COMPANY.invoicePrefix) && p.prefix === COMPANY.invoicePrefix;
      fy = follows ? p.fy : null;
      seq = follows ? p.seq : null;
    } else {
      ({ number, fy, seq } = await nextInvoiceNo(tx, req.invoiceDate));
    }
    if (await tx.invoice.findFirst({ where: { number, NOT: { id: req.draftId ?? -1 } } })) throw new InvoiceError(`Invoice number ${number} is already used`);
    if (fy && seq && (await tx.invoice.findFirst({ where: { fy, seq, NOT: { id: req.draftId ?? -1 } } }))) throw new InvoiceError(`Invoice number ${number} is already used`);

    const buyer = buyerSnapshot(client);
    const lines = trips.map((t) => lineFor(t, client.handlingLabel));
    const vinRows = trips.flatMap((t) => t.vins.map((v) => vinRowFor(v, t.lrNo)));
    const data = {
      number,
      fy,
      seq,
      consignorId: client.id,
      invoiceDate: req.invoiceDate,
      period: fyPeriod(req.invoiceDate),
      placeOfSupply: COMPANY.placeOfSupply,
      ...money(totals),
      status: "ISSUED",
      seller: JSON.stringify(sellerSnapshot()),
      buyer: JSON.stringify(buyer),
      lines: JSON.stringify(lines),
      vinRows: JSON.stringify(vinRows),
      issuedAt: new Date(),
    };
    const inv = req.draftId
      ? await tx.invoice.update({ where: { id: req.draftId }, data })
      : await tx.invoice.create({ data: { ...data, createdBy: user } });
    if (req.draftId) await tx.trip.updateMany({ where: { invoiceId: inv.id, id: { notIn: req.tripIds } }, data: { invoiceId: null } });
    await tx.trip.updateMany({ where: { id: { in: req.tripIds } }, data: { invoiceId: inv.id, billingStatus: "INVOICED" } });
    await audit(tx, user, inv.id, "ISSUE", {
      number,
      client: client.name,
      trips: trips.map((t) => t.lrNo),
      subtotal: totals.subtotal,
      tax: totals.igst + totals.cgst + totals.sgst,
      total: totals.total,
      vins: vinRows.length,
      vinWarnings: vinReport?.trips.filter((t) => !t.ok).map((t) => ({ lr: t.lrNo, warnings: t.warnings })) ?? [],
    });
    return { id: inv.id, number };
  }, { timeout: 60_000 });
}

export async function markPaid(db: Db, id: number, user: string, paidOn = new Date()) {
  return db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id } });
    if (inv.status !== "ISSUED") throw new InvoiceError(`Only issued invoices can be marked paid (this one is ${inv.status.toLowerCase()})`);
    await tx.invoice.update({ where: { id }, data: { status: "PAID", paidAt: paidOn } });
    await tx.trip.updateMany({ where: { invoiceId: id }, data: { billingStatus: "PAID" } });
    await audit(tx, user, id, "PAID", { number: inv.number, paidOn: paidOn.toISOString().slice(0, 10) });
  });
}

/** Cancels an issued or paid invoice: the number stays used, the trips are unlocked for re-billing. */
export async function cancelInvoice(db: Db, id: number, user: string, reason?: string) {
  return db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id } });
    if (inv.status === "CANCELLED") throw new InvoiceError("This invoice is already cancelled");
    if (inv.status === "DRAFT") throw new InvoiceError("Delete the draft instead");
    const trips = await tx.trip.updateMany({ where: { invoiceId: id }, data: { invoiceId: null, billingStatus: "UNBILLED" } });
    await tx.invoice.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await audit(tx, user, id, "CANCEL", { number: inv.number, tripsUnlocked: trips.count, reason: reason ?? null });
  });
}

export async function deleteDraft(db: Db, id: number, user: string) {
  return db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id } });
    if (inv.status !== "DRAFT") throw new InvoiceError("Only drafts can be deleted; cancel an issued invoice instead");
    await tx.trip.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
    await tx.invoice.delete({ where: { id } });
    await audit(tx, user, id, "DELETE", { draft: true, total: inv.total });
  });
}

// ---------- document ----------

export async function readSignature(): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), COMPANY.signatureFile));
  } catch {
    return null;
  }
}

/**
 * The printable document for an invoice. Issued/paid/cancelled invoices use their frozen snapshot;
 * drafts are assembled from the current trips and client (that's what the review step previews).
 */
export async function invoiceDocument(db: DbTx, id: number, opts: { signature?: boolean } = {}): Promise<InvoiceDocument & { status: string }> {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id }, include: { consignor: true } });
  const signature = opts.signature === false ? null : await readSignature();
  const totals: InvoiceTotals = { subtotal: inv.subtotal, igst: inv.igst, cgst: inv.cgst, sgst: inv.sgst, roundOff: inv.roundOff, total: inv.total, intraState: inv.igst === 0 && inv.cgst > 0 };
  if (inv.lines && inv.seller && inv.buyer) {
    const parse = <T>(s: string, dates: string[] = []) =>
      JSON.parse(s, (k, v) => (dates.includes(k) && typeof v === "string" ? new Date(v) : v)) as T;
    const intra = inv.cgst > 0 || inv.sgst > 0;
    return {
      status: inv.status,
      seller: parse<SellerSnapshot>(inv.seller),
      buyer: parse<BuyerDetails>(inv.buyer),
      number: inv.number ?? "",
      invoiceDate: inv.invoiceDate,
      period: inv.period,
      placeOfSupply: inv.placeOfSupply,
      lines: parse<InvoiceLine[]>(inv.lines, ["dispDate"]),
      vins: parse<VinRow[]>(inv.vinRows ?? "[]", ["dispatchDate"]),
      totals: { ...totals, intraState: intra },
      signature,
    };
  }
  const trips = await loadTrips(db, (await db.trip.findMany({ where: { invoiceId: id }, select: { id: true } })).map((t) => t.id));
  const live = computeInvoice({ amounts: trips.map((t) => t.freight), sellerStateCode: COMPANY.stateCodeForGst, buyerStateCode: inv.consignor.stateCode });
  return {
    status: inv.status,
    seller: sellerSnapshot(),
    buyer: buyerSnapshot(inv.consignor),
    number: inv.number ?? (await nextInvoiceNo(db, inv.invoiceDate)).number,
    invoiceDate: inv.invoiceDate,
    period: inv.period,
    placeOfSupply: inv.placeOfSupply,
    lines: trips.map((t) => lineFor(t, inv.consignor.handlingLabel)),
    vins: trips.flatMap((t) => t.vins.map((v) => vinRowFor(v, t.lrNo))),
    totals: live,
    signature,
  };
}

export async function invoiceXlsx(db: DbTx, id: number): Promise<{ buffer: Buffer; filename: string }> {
  const [doc, inv] = await Promise.all([
    invoiceDocument(db, id),
    db.invoice.findUniqueOrThrow({ where: { id }, select: { seq: true, number: true, consignor: { select: { name: true } } } }),
  ]);
  const buffer = await buildInvoiceXlsx(doc);
  // Same naming as the office's files: "JKTI_INV_108.xlsx".
  const ref = inv.seq ?? inv.number ?? `DRAFT-${id}`;
  return { buffer, filename: `${inv.consignor.name.replace(/[^A-Z0-9]+/gi, "_")}_INV_${ref}.xlsx` };
}

export { formatDmy };
