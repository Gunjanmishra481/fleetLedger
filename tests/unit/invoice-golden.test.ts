// Golden test: rebuild invoice MKLAMD2627108 through the app (client, trailers, trips, VIN sheet,
// issue) and compare the generated workbook with tests/fixtures/invoices/JKTI_INV_108.xlsx.
// Writes tests/output/JKTI_INV_108_generated.xlsx for a side-by-side look.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { readReferenceInvoice, type ReferenceInvoice } from "@/server/invoice/reference";
import { buildInvoiceXlsx } from "@/server/invoice/xlsx";
import { checkVins, invoiceDocument, invoiceXlsx, issueInvoice, sellerSnapshot } from "@/server/services/invoice";
import { computeInvoice } from "@/server/invoice/maths";
import { COMPANY } from "@/config/company";
import { monthKeyOf } from "@/server/services/trip";

const REF = "tests/fixtures/invoices/JKTI_INV_108.xlsx";
const OUT = "tests/output/JKTI_INV_108_generated.xlsx";
const db = new PrismaClient();
let ref: ReferenceInvoice;
let refWb: ExcelJS.Workbook;
let outWb: ExcelJS.Workbook;
let invoiceId: number;
let tripIds: number[] = [];
// Masters this test created (and must remove), so other test files see the database as they left it.
const createdVehicles: number[] = [];
const createdPlaces: number[] = [];
const modelSetOn: number[] = [];

beforeAll(async () => {
  ref = await readReferenceInvoice(await readFile(REF));

  // Master data the invoice needs, as the office would have it.
  const client = await db.consignor.create({
    data: { name: "JKTI", billingName: ref.buyer.billingName, addressLines: ref.buyer.addressLines, gstin: ref.buyer.gstin, pan: ref.buyer.pan, state: ref.buyer.state, stateCode: ref.buyer.stateCode, handlingLabel: ref.buyer.handlingLabel },
  });
  const origin = await db.location.create({ data: { name: "GOLDEN JKTI (CHHARODI)", kind: "LOADING_POINT", consignorId: client.id } });
  const place = new Map<string, number>();
  const vehicle = new Map<string, number>();
  for (const l of ref.lines) {
    if (!place.has(l.delivery)) {
      const found = await db.location.findUnique({ where: { name: l.delivery } });
      const id = found?.id ?? (await db.location.create({ data: { name: l.delivery, kind: "DESTINATION" } })).id;
      if (!found) createdPlaces.push(id);
      place.set(l.delivery, id);
    }
    if (!vehicle.has(l.carrierNo)) {
      const found = await db.vehicle.findUnique({ where: { regNo: l.carrierNo } });
      const id = found?.id ?? (await db.vehicle.create({ data: { regNo: l.carrierNo, model: l.model } })).id;
      if (!found) createdVehicles.push(id);
      else if (!found.model && l.model) {
        // As prisma/seed-invoice.ts does for existing trailers.
        await db.vehicle.update({ where: { id }, data: { model: l.model } });
        modelSetOn.push(id);
      }
      vehicle.set(l.carrierNo, id);
    }
  }
  // One trip per invoice line, entered as the trip register would have it (freight = the line amount).
  for (const [i, l] of ref.lines.entries()) {
    const t = await db.trip.create({
      data: {
        serialNo: i + 1, tripDate: l.dispDate, monthKey: monthKeyOf(l.dispDate), lrNo: l.lrNo, vehicleId: vehicle.get(l.carrierNo)!, originId: origin.id,
        carsCount: l.vins, dieselL: 0, dieselRate: 0, podCharge: 0, maintenance: 0, driverAllowance: 0, freight: l.amount,
        dieselAmount: 0, totalCost: 0, profit: l.amount, createdBy: "golden", stops: { create: [{ locationId: place.get(l.delivery)!, seq: 1 }] },
      },
    });
    tripIds.push(t.id);
  }

  ({ id: invoiceId } = await issueInvoice(db, { consignorId: client.id, tripIds, invoiceDate: ref.invoiceDate, number: ref.number, vinRows: ref.vins }, "golden"));

  const { buffer } = await invoiceXlsx(db, invoiceId);
  await mkdir("tests/output", { recursive: true });
  await writeFile(OUT, buffer);
  refWb = new ExcelJS.Workbook();
  await refWb.xlsx.readFile(REF);
  outWb = new ExcelJS.Workbook();
  await outWb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
}, 180_000);

afterAll(async () => {
  await db.tripVin.deleteMany({ where: { trip: { createdBy: "golden" } } });
  await db.trip.deleteMany({ where: { createdBy: "golden" } });
  await db.invoice.deleteMany({ where: { createdBy: "golden" } });
  await db.location.deleteMany({ where: { OR: [{ name: "GOLDEN JKTI (CHHARODI)" }, { id: { in: createdPlaces } }] } });
  await db.vehicle.deleteMany({ where: { id: { in: createdVehicles } } });
  await db.vehicle.updateMany({ where: { id: { in: modelSetOn } }, data: { model: null } });
  await db.consignor.deleteMany({ where: { name: "JKTI" } });
  await db.$disconnect();
});

const val = (c: ExcelJS.Cell) => {
  const v = c.value as unknown;
  if (v instanceof Date) return { date: v.getTime() };
  if (v && typeof v === "object" && "formula" in v) return { formula: (v as { formula: string }).formula };
  if (v && typeof v === "object" && "sharedFormula" in v) return { formula: "shared" };
  return v;
};
const cached = (ws: ExcelJS.Worksheet, a: string) => (ws.getCell(a).value as { result?: number }).result;

describe("invoice 108 rebuilt from its own data", () => {
  it("has the reference totals", async () => {
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(inv).toMatchObject({ number: "MKLAMD2627108", fy: "2627", seq: 108, status: "ISSUED", subtotal: 43628910, igst: 7853204, cgst: 0, sgst: 0, roundOff: -14, total: 51482100, period: "2026-2027", placeOfSupply: "Gujarat" });
    const ws = outWb.getWorksheet("INVOICE")!;
    expect(cached(ws, "F33")).toBe(100);
    expect(cached(ws, "K33")).toBe(436289.1);
    expect(cached(ws, "K34")).toBe(78532.04);
    expect(cached(ws, "K37")).toBe(-0.14);
    expect(cached(ws, "K38")).toBe(514821);
    expect(ws.getCell("C37").value).toBe("Five Lakh Fourteen Thousand Eight Hundred Twenty One Only");
  });

  it("locks the 15 trips and records their 100 VINs", async () => {
    const trips = await db.trip.findMany({ where: { id: { in: tripIds } }, include: { _count: { select: { vins: true } } } });
    expect(trips.every((t) => t.invoiceId === invoiceId && t.billingStatus === "INVOICED")).toBe(true);
    expect(trips.reduce((n, t) => n + t._count.vins, 0)).toBe(100);
  });

  it("flags the carrier on LR 1706 (invoice NL01AL3653, VIN sheet NL01N3653)", async () => {
    const report = await checkVins(db, tripIds, ref.vins);
    expect(report.trips.filter((t) => !t.ok).map((t) => [t.lrNo, t.warnings])).toEqual([["1706", ["Carrier NL01N3653 on the sheet, trailer NL01AL3653 on the trip"]]]);
  });

  it("puts every non-empty reference INVOICE cell at the same address with the same value", () => {
    const a = refWb.getWorksheet("INVOICE")!;
    const b = outWb.getWorksheet("INVOICE")!;
    const diffs: string[] = [];
    let compared = 0;
    a.eachRow({ includeEmpty: true }, (row) =>
      row.eachCell({ includeEmpty: false }, (c) => {
        const want = val(c);
        if (want === null || want === undefined || want === "") return;
        compared++;
        const got = val(b.getCell(c.address));
        // The words line follows the requested Title Case; the reference used sentence case.
        const same = c.address.match(/^[C-I]37$/) ? String(got).toLowerCase() === String(want).toLowerCase() : JSON.stringify(got) === JSON.stringify(want);
        if (!same) diffs.push(`${c.address}: want ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
      }),
    );
    expect(diffs).toEqual([]);
    expect(compared).toBeGreaterThan(250);
  });

  it("matches the reference styles, merges, widths, heights, print setup and signature position", () => {
    const a = refWb.getWorksheet("INVOICE")!;
    const b = outWb.getWorksheet("INVOICE")!;
    const diffs: string[] = [];
    // Key order differs between exceljs reads and writes; compare canonically.
    const canon = (o: unknown): unknown =>
      Array.isArray(o) ? o.map(canon) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => [k, canon(v)])) : o;
    const pick = (s: Partial<ExcelJS.Style>) =>
      JSON.stringify(canon({
        font: s.font,
        alignment: s.alignment,
        border: s.border,
        fill: s.fill,
        numFmt: s.numFmt,
      }));
    a.eachRow({ includeEmpty: true }, (row) =>
      row.eachCell({ includeEmpty: true }, (c) => {
        if (!Object.keys(c.style ?? {}).length) return;
        if (pick(c.style) !== pick(b.getCell(c.address).style)) diffs.push(`${c.address}: ${pick(c.style)} vs ${pick(b.getCell(c.address).style)}`);
      }),
    );
    expect(diffs).toEqual([]);
    expect([...b.model.merges].sort()).toEqual([...a.model.merges].sort());
    for (let i = 1; i <= 11; i++) expect(b.getColumn(i).width).toBe(a.getColumn(i).width);
    for (let r = 1; r <= a.rowCount; r++) expect(b.getRow(r).height, `row ${r} height`).toBe(a.getRow(r).height);
    for (const k of ["orientation", "scale", "fitToPage", "fitToWidth", "fitToHeight", "margins"] as const) expect(b.pageSetup[k]).toEqual(a.pageSetup[k]);
    const anchor = (ws: ExcelJS.Worksheet) => {
      const im = ws.getImages()[0];
      return [im.range.tl, im.range.br].map((x) => ({ c: x.nativeCol, co: x.nativeColOff, r: x.nativeRow, ro: x.nativeRowOff }));
    };
    expect(anchor(b)).toEqual(anchor(a));
    const bytes = (wb: ExcelJS.Workbook) => (wb.model.media?.[0]?.buffer as unknown as Uint8Array | undefined)?.length;
    expect(bytes(outWb)).toBe(bytes(refWb));
  });

  it("reproduces the VIN DETAILS sheet (100 rows, same values and columns)", () => {
    const a = refWb.getWorksheet("VIN DETAILS")!;
    const b = outWb.getWorksheet("VIN DETAILS")!;
    const diffs: string[] = [];
    a.eachRow({ includeEmpty: false }, (row) =>
      row.eachCell({ includeEmpty: false }, (c) => {
        if (JSON.stringify(val(b.getCell(c.address))) !== JSON.stringify(val(c))) diffs.push(`${c.address}: want ${JSON.stringify(val(c))} got ${JSON.stringify(val(b.getCell(c.address)))}`);
      }),
    );
    expect(diffs).toEqual([]);
    expect(b.rowCount).toBe(101);
    for (let i = 1; i <= 15; i++) expect(b.getColumn(i).width).toBe(a.getColumn(i).width);
  });
});

describe("longer invoices", () => {
  it("inserts rows and shifts the totals block, merges and signature down", async () => {
    const base = await invoiceDocument(db, invoiceId);
    const lines = Array.from({ length: 25 }, (_, i) => ({ ...base.lines[i % base.lines.length], lrNo: String(5000 + i) }));
    const totals = computeInvoice({ amounts: lines.map((l) => l.amount), sellerStateCode: COMPANY.stateCodeForGst, buyerStateCode: "24" });
    const buf = await buildInvoiceXlsx({ ...base, seller: sellerSnapshot(), lines, totals });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const ws = wb.getWorksheet("INVOICE")!;
    // 25 lines, 18 line rows before the closing row: the closing row and everything below move down 7.
    expect(ws.getCell("B38").value).toBe(25);
    expect(ws.getCell("C39").value).toBeNull(); // closing row
    expect((ws.getCell("F40").value as { formula: string }).formula).toBe("SUM(F14:F39)");
    expect(ws.getCell("J40").value).toBe("Sub Total");
    expect((ws.getCell("K42").value as { formula: string }).formula).toBe("K40*9/100"); // intra-state: CGST row
    expect((ws.getCell("K43").value as { formula: string }).formula).toBe("K40*9/100"); // SGST row
    expect(ws.getCell("K41").value).toBeNull(); // no IGST
    expect(ws.getCell("J51").value).toBe("Authorized Signatory");
    expect(ws.model.merges).toContain("C44:I44");
    expect(ws.getImages()[0].range.tl.nativeRow).toBe(47);
  });
});
