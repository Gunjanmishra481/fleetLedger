// Builds the invoice workbook ("INVOICE" + "VIN DETAILS") in the reference layout.
// Styles, merges, widths, heights, print setup and the signature anchor come from layout.json,
// which tests/tools/extract-invoice-layout.cjs generates from the reference file.
import ExcelJS from "exceljs";
import layoutJson from "./layout.json";
import type { BuyerDetails, InvoiceLine, VinRow } from "./reference";
import type { InvoiceTotals } from "./maths";
import { amountInWords } from "./maths";

type CellSpec = { address: string; row: number; col: number; style: Partial<ExcelJS.Style>; value: unknown };
type Layout = {
  invoice: {
    columns: { letter: string; width: number | null }[];
    rowHeights: Record<string, number>;
    merges: string[];
    pageSetup: Partial<ExcelJS.PageSetup>;
    views: Partial<ExcelJS.WorksheetView>[];
    properties: Partial<ExcelJS.WorksheetProperties>;
    firstLineRow: number;
    lineCapacityLastRow: number;
    totalsFirstRow: number;
    headerCells: CellSpec[];
    footerCells: CellSpec[];
    lineRowStyles: Record<string, Record<string, Partial<ExcelJS.Style>>>;
    referenceLineCount: number;
    blankLineRow: number;
    signature: {
      tl: { nativeCol: number; nativeColOff: number; nativeRow: number; nativeRowOff: number };
      br: { nativeCol: number; nativeColOff: number; nativeRow: number; nativeRowOff: number };
      editAs: string;
    } | null;
  };
  vinDetails: {
    columns: { letter: string; width: number | null }[];
    rowHeights: Record<string, number>;
    pageSetup: Partial<ExcelJS.PageSetup>;
    views: Partial<ExcelJS.WorksheetView>[];
    properties: Partial<ExcelJS.WorksheetProperties>;
    header: { col: number; value: string; style: Partial<ExcelJS.Style> }[];
    rowStyle: Record<string, Partial<ExcelJS.Style>>;
  };
};
const L = layoutJson as unknown as Layout;

/** Seller as printed: COMPANY (src/config/company.ts), frozen into the invoice at issue. */
export type SellerSnapshot = {
  name: string;
  addressLines: string[];
  phone: string;
  contactNo: string;
  pan: string;
  gstin: string;
  stateCode: string;
  sacCode: string;
  bank: { beneficiary: string; accountNo: string; ifsc: string; bankName: string };
};

export type InvoiceDocument = {
  seller: SellerSnapshot;
  buyer: BuyerDetails;
  number: string;
  invoiceDate: Date;
  period: string;
  placeOfSupply: string;
  lines: InvoiceLine[];
  vins: VinRow[];
  totals: InvoiceTotals;
  signature: Buffer | null;
};

/** Digits-only strings become numbers, as in the reference (LR 1685, account 8153019021). */
function numOrText(s: string | null | undefined): string | number | null {
  if (s === null || s === undefined || s === "") return null;
  return /^\d{1,15}$/.test(s) ? Number(s) : s;
}

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
const r2 = (paise: number) => paise / 100; // display value in rupees (cached results)

function applySheetMeta(
  ws: ExcelJS.Worksheet,
  meta: { columns: { width: number | null }[]; pageSetup: Partial<ExcelJS.PageSetup>; views: Partial<ExcelJS.WorksheetView>[]; properties: Partial<ExcelJS.WorksheetProperties> },
) {
  meta.columns.forEach((c, i) => {
    if (c.width) ws.getColumn(i + 1).width = c.width;
  });
  Object.assign(ws.pageSetup, clone(meta.pageSetup));
  ws.views = clone(meta.views) as ExcelJS.WorksheetView[];
  Object.assign(ws.properties, clone(meta.properties));
}

export async function buildInvoiceXlsx(doc: InvoiceDocument): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = doc.seller.name;
  const ws = wb.addWorksheet("INVOICE");
  const lay = L.invoice;
  applySheetMeta(ws, lay);

  // Line area: rows 14..31 for lines (or the reference's empty bordered rows), then a closing row
  // (32 in the reference). More lines than fit push the closing row and everything below it down.
  const closingRef = lay.lineCapacityLastRow;
  const capacity = closingRef - lay.firstLineRow;
  const shift = Math.max(0, doc.lines.length - capacity);
  const lastLineRow = closingRef + shift;
  const at = (row: number) => (row >= closingRef ? row + shift : row);
  const cell = (col: string, row: number) => ws.getCell(`${col}${at(row)}`);

  for (const [r, h] of Object.entries(lay.rowHeights)) ws.getRow(at(Number(r))).height = h;

  // Static header and footer: styles and labels.
  const put = (c: CellSpec) => {
    const target = ws.getCell(at(c.row), c.col);
    target.style = clone(c.style);
    if (c.value !== null) {
      const v = c.value as { date?: string };
      target.value = v && typeof v === "object" && "date" in v ? new Date(v.date!) : (c.value as ExcelJS.CellValue);
    }
  };
  lay.headerCells.forEach(put);
  lay.footerCells.forEach(put);

  for (const m of lay.merges) {
    const [a, b] = m.split(":");
    const ra = Number(a.replace(/\D/g, ""));
    const rb = Number(b.replace(/\D/g, ""));
    // Keep each merged cell's own style: borders differ along a merged range in the reference.
    ws.mergeCellsWithoutStyle(`${a.replace(/\d+/, "")}${at(ra)}:${b.replace(/\d+/, "")}${at(rb)}`);
  }

  // Seller block.
  const s = doc.seller;
  cell("B", 3).value = s.name;
  [4, 5, 6].forEach((r, i) => (cell("B", r).value = s.addressLines[i] ?? null));
  cell("B", 7).value = `Phone: ${s.phone}`;
  cell("B", 8).value = `STATE CODE- ${s.stateCode}`;
  cell("B", 9).value = `PAN NO: ${s.pan}`;
  cell("B", 10).value = `GST NO-${s.gstin}`;
  cell("C", 11).value = numOrText(s.sacCode);

  // Buyer block (two address rows; any further lines are joined onto the second).
  const b = doc.buyer;
  cell("G", 3).value = b.billingName;
  cell("G", 4).value = b.addressLines[0] ?? null;
  cell("G", 5).value = b.addressLines.length > 1 ? b.addressLines.slice(1).join(", ") : null;
  cell("G", 6).value = b.gstin ? `GSTNN: ${b.gstin}` : null;
  cell("G", 7).value = b.pan ? `PAN: ${b.pan}` : null;
  cell("G", 8).value = b.state ? `STATE: ${b.state}` : null;
  cell("G", 9).value = b.stateCode ? `STATE CODE: ${b.stateCode}` : null;

  // Invoice meta.
  cell("J", 3).value = doc.invoiceDate;
  cell("J", 4).value = doc.number;
  cell("J", 5).value = numOrText(s.contactNo);
  cell("J", 6).value = doc.period;
  cell("K", 10).value = doc.placeOfSupply;

  // Lines.
  const styleRow = (r: number, styles: Record<string, Partial<ExcelJS.Style>>) => {
    for (const [c, st] of Object.entries(styles)) ws.getCell(`${c}${r}`).style = clone(st);
  };
  doc.lines.forEach((l, i) => {
    const r = lay.firstLineRow + i;
    // The reference's own row styles where it had lines; its first line row's style beyond that.
    styleRow(r, lay.lineRowStyles[String(i < lay.referenceLineCount ? r : lay.firstLineRow)]);
    ws.getCell(`B${r}`).value = i + 1;
    ws.getCell(`C${r}`).value = l.carrierNo;
    ws.getCell(`D${r}`).value = l.model;
    ws.getCell(`E${r}`).value = numOrText(l.lrNo);
    ws.getCell(`F${r}`).value = l.vins;
    ws.getCell(`G${r}`).value = l.handling;
    ws.getCell(`H${r}`).value = l.delivery;
    ws.getCell(`I${r}`).value = l.tptr;
    ws.getCell(`J${r}`).value = l.dispDate;
    ws.getCell(`K${r}`).value = r2(l.amount);
  });
  for (let r = lay.firstLineRow + doc.lines.length; r < lastLineRow; r++) {
    const own = r >= lay.blankLineRow && r < closingRef ? r : lay.blankLineRow;
    styleRow(r, lay.lineRowStyles[String(own)]); // empty bordered row
  }
  styleRow(lastLineRow, lay.lineRowStyles[String(closingRef)]); // closing row

  // Totals: the reference's formulas, with cached values so the file is right before recalculation.
  const t = doc.totals;
  const T = lay.totalsFirstRow; // 33
  const vinTotal = doc.lines.reduce((n, l) => n + l.vins, 0);
  cell("F", T).value = { formula: `SUM(F${lay.firstLineRow}:F${lastLineRow})`, result: vinTotal };
  cell("K", T).value = { formula: `SUM(K${lay.firstLineRow}:K${lastLineRow})`, result: r2(t.subtotal) };
  const k = (row: number) => `K${at(row)}`;
  if (t.intraState) {
    cell("K", T + 2).value = { formula: `${k(T)}*9/100`, result: r2(t.cgst) };
    cell("K", T + 3).value = { formula: `${k(T)}*9/100`, result: r2(t.sgst) };
  } else {
    cell("K", T + 1).value = { formula: `${k(T)}*18/100`, result: r2(t.igst) };
  }
  // Round off keeps the total a whole rupee even after Excel recalculates the tax formulas.
  const pre = `SUM(${k(T)}:${k(T + 3)})`;
  cell("K", T + 4).value = { formula: `ROUND(${pre},0)-${pre}`, result: r2(t.roundOff) };
  cell("K", T + 5).value = { formula: `SUM(${k(T)}:${k(T + 4)})`, result: r2(t.total) };
  // The reference leaves K35–K37 unstyled (they were empty there); give them the IGST cell's look.
  const taxStyle = ws.getCell(k(T + 1)).style;
  for (const row of [T + 2, T + 3, T + 4]) {
    const c = ws.getCell(k(row));
    if (!c.style || !Object.keys(c.style).length || !c.style.numFmt) c.style = clone(taxStyle);
  }
  cell("C", 37).value = amountInWords(t.total / 100);

  // Bank block and the name above the signature.
  cell("F", 40).value = s.bank.beneficiary;
  cell("F", 41).value = numOrText(s.bank.accountNo);
  cell("F", 42).value = s.bank.ifsc;
  cell("F", 43).value = s.bank.bankName;
  cell("J", 40).value = s.name;

  if (doc.signature && lay.signature) {
    const id = wb.addImage({ buffer: doc.signature as unknown as ExcelJS.Buffer, extension: "jpeg" });
    const sh = (a: typeof lay.signature.tl) => ({ ...a, nativeRow: a.nativeRow + 1 >= closingRef ? a.nativeRow + shift : a.nativeRow });
    ws.addImage(id, { tl: sh(lay.signature.tl), br: sh(lay.signature.br), editAs: lay.signature.editAs } as unknown as ExcelJS.ImageRange);
  }

  // VIN DETAILS.
  const vs = wb.addWorksheet("VIN DETAILS");
  const vl = L.vinDetails;
  applySheetMeta(vs, vl);
  for (const [r, h] of Object.entries(vl.rowHeights)) if (Number(r) === 1) vs.getRow(1).height = h;
  for (const h of vl.header) {
    const c = vs.getCell(1, h.col);
    c.value = h.value;
    c.style = clone(h.style);
  }
  doc.vins.forEach((v, i) => {
    const r = i + 2;
    const values: ExcelJS.CellValue[] = [
      v.vin, v.model, v.oem, v.region, v.dealerCode, v.dealerName, v.dealerLocation, v.oemInvoiceDate,
      numOrText(v.oemInvoiceNo), numOrText(v.lotNo), numOrText(v.loafNo), v.lastMileTpt, v.carrierNo, v.dispatchDate, numOrText(v.lrNo),
    ];
    values.forEach((val, j) => {
      const c = vs.getCell(r, j + 1);
      c.style = clone(vl.rowStyle[String(j + 1)] ?? {});
      c.value = val;
    });
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
