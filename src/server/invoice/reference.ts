// Reads an invoice laid out like the reference (tests/fixtures/invoices/JKTI_INV_108.xlsx):
// seller and buyer blocks, invoice meta, line rows, VIN DETAILS rows and the signature image.
// Used to seed the company profile and the client, and by the golden test.
import ExcelJS from "exceljs";

export type SellerDetails = {
  name: string;
  addressLines: string[];
  phone: string | null;
  contactNo: string | null;
  pan: string | null;
  gstin: string | null;
  state: string | null;
  stateCode: string | null;
  sacCode: string | null;
  bankBeneficiary: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  invoicePrefix: string;
  transporterShortName: string | null;
};

export type BuyerDetails = {
  billingName: string;
  addressLines: string[];
  gstin: string | null;
  pan: string | null;
  state: string | null;
  stateCode: string | null;
  handlingLabel: string | null;
};

export type InvoiceLine = {
  carrierNo: string;
  model: string | null;
  lrNo: string;
  vins: number;
  handling: string | null;
  delivery: string;
  tptr: string | null;
  dispDate: Date;
  amount: number; // paise
};

export type VinRow = {
  vin: string;
  model: string | null;
  oem: string | null;
  region: string | null;
  dealerCode: string | null;
  dealerName: string | null;
  dealerLocation: string | null;
  oemInvoiceDate: string | null;
  oemInvoiceNo: string | null;
  lotNo: string | null;
  loafNo: string | null;
  lastMileTpt: string | null;
  carrierNo: string | null;
  dispatchDate: Date | null;
  lrNo: string | null;
};

export type ReferenceInvoice = {
  seller: SellerDetails;
  buyer: BuyerDetails;
  number: string;
  fy: string | null;
  seq: number | null;
  invoiceDate: Date;
  period: string;
  placeOfSupply: string;
  lines: InvoiceLine[];
  vins: VinRow[];
  signature: { buffer: Buffer; mime: string } | null;
};

function raw(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return v.result;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
  }
  return v;
}

/** Cell as text (numbers without float noise), or null when blank. */
export function text(v: ExcelJS.CellValue): string | null {
  const x = raw(v);
  if (x === null || x === undefined) return null;
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  const s = String(x);
  return s.trim() === "" ? null : s;
}

function toDate(v: ExcelJS.CellValue): Date | null {
  const x = raw(v);
  if (x instanceof Date) return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
  if (typeof x === "number") return new Date(Date.UTC(1899, 11, 30) + Math.round(x) * 86_400_000);
  if (typeof x === "string") {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(x.trim());
    if (m) return new Date(Date.UTC(Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  }
  return null;
}

/** Strips a printed label like "PAN NO: " or "GST NO-" from the front of a value. */
function after(label: RegExp, s: string | null): string | null {
  if (!s) return null;
  const v = s.replace(label, "").trim();
  return v || null;
}

/** Splits "MKLAMD2627108" into prefix "MKLAMD", FY "2627", running number 108. */
export function parseInvoiceNumber(n: string): { prefix: string; fy: string; seq: number } | null {
  const m = /^(.*?)(\d{2})(\d{2})(\d+)$/.exec(n.trim());
  if (!m || Number(m[3]) !== (Number(m[2]) + 1) % 100) return null;
  return { prefix: m[1], fy: m[2] + m[3], seq: Number(m[4]) };
}

const paise = (n: number) => Math.round(n * 100);

/** VIN DETAILS rows (header row "VIN NO" ...). Also used for a client's standalone VIN sheet. */
export function readVinSheet(ws: ExcelJS.Worksheet): VinRow[] {
  let headerRow = 0;
  const col: Record<string, number> = {};
  ws.eachRow((row, r) => {
    if (headerRow) return;
    const names: Record<string, number> = {};
    row.eachCell((c, i) => {
      const h = (text(c.value) ?? "").toUpperCase().replace(/\s+/g, " ").trim();
      if (h) names[h] = i;
    });
    if (names["VIN NO"] || names["VIN"]) {
      headerRow = r;
      Object.assign(col, names);
    }
  });
  if (!headerRow) return [];
  const pick = (...keys: string[]) => keys.map((k) => col[k]).find(Boolean);
  const C = {
    vin: pick("VIN NO", "VIN"),
    model: pick("MODEL"),
    oem: pick("MANUFACTURER (OEM)", "OEM", "MANUFACTURER"),
    region: pick("REGION"),
    dealerCode: pick("DEALER CODE"),
    dealerName: pick("DEALER NAME"),
    dealerLocation: pick("DEALER LOCATION"),
    oemInvoiceDate: pick("INVOICE DATE"),
    oemInvoiceNo: pick("INVOICE NUMBER", "INVOICE NO"),
    lotNo: pick("LOT NO"),
    loafNo: pick("LOAF NO"),
    lastMileTpt: pick("LAST MILE TPT NAME", "LAST MILE TPT"),
    carrierNo: pick("CARRIER NO", "TRAILER NO"),
    dispatchDate: pick("DISP DATE", "DISPATCH DATE"),
    lrNo: pick("LR NO", "LR NO."),
  };
  const rows: VinRow[] = [];
  ws.eachRow((row, r) => {
    if (r <= headerRow) return;
    const get = (c: number | undefined) => (c ? text(row.getCell(c).value) : null);
    const vin = get(C.vin);
    if (!vin) return;
    const oemDate = C.oemInvoiceDate ? row.getCell(C.oemInvoiceDate).value : null;
    rows.push({
      vin: vin.trim().toUpperCase(),
      model: get(C.model),
      oem: get(C.oem),
      region: get(C.region),
      dealerCode: get(C.dealerCode),
      dealerName: get(C.dealerName),
      dealerLocation: get(C.dealerLocation),
      // Keep the client's text ("12/10/2026"); a real date cell is written the same way.
      oemInvoiceDate: oemDate instanceof Date ? formatDmy(oemDate) : get(C.oemInvoiceDate),
      oemInvoiceNo: get(C.oemInvoiceNo),
      lotNo: get(C.lotNo),
      loafNo: get(C.loafNo),
      lastMileTpt: get(C.lastMileTpt),
      carrierNo: get(C.carrierNo)?.toUpperCase().replace(/[\s-]+/g, "") ?? null,
      dispatchDate: C.dispatchDate ? toDate(row.getCell(C.dispatchDate).value) : null,
      lrNo: get(C.lrNo)?.toUpperCase().replace(/\s+/g, "") ?? null,
    });
  });
  return rows;
}

export function formatDmy(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export async function readReferenceInvoice(data: ArrayBuffer | Buffer): Promise<ReferenceInvoice> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet("INVOICE");
  if (!ws) throw new Error('The workbook has no "INVOICE" sheet');
  const t = (a: string) => text(ws.getCell(a).value);

  // Seller: B3 name, then address lines until the "Phone:" line.
  const sellerAddress: string[] = [];
  for (let r = 4; r <= 7; r++) {
    const v = t(`B${r}`);
    if (!v || /^phone/i.test(v)) break;
    sellerAddress.push(v);
  }
  const buyerAddress: string[] = [];
  for (let r = 4; r <= 6; r++) {
    const v = t(`G${r}`);
    if (!v || /^GST/i.test(v)) break;
    buyerAddress.push(v);
  }

  const number = t("J4") ?? "";
  const parsedNo = parseInvoiceNumber(number);
  const lines: InvoiceLine[] = [];
  for (let r = 14; r <= 200; r++) {
    const carrier = t(`C${r}`);
    if (!carrier) break;
    lines.push({
      carrierNo: carrier,
      model: t(`D${r}`),
      lrNo: t(`E${r}`) ?? "",
      vins: Number(raw(ws.getCell(`F${r}`).value) ?? 0),
      handling: t(`G${r}`),
      delivery: t(`H${r}`) ?? "",
      tptr: t(`I${r}`),
      dispDate: toDate(ws.getCell(`J${r}`).value)!,
      amount: paise(Number(raw(ws.getCell(`K${r}`).value) ?? 0)),
    });
  }

  const vinWs = wb.getWorksheet("VIN DETAILS");
  const img = ws.getImages()[0];
  const media = img ? wb.getImage(Number(img.imageId)) : null;

  return {
    seller: {
      name: t("B3") ?? "",
      addressLines: sellerAddress,
      phone: after(/^phone:\s*/i, t("B7")),
      contactNo: t("J5"),
      pan: after(/^PAN NO:\s*/i, t("B9")),
      gstin: after(/^GST NO-?\s*/i, t("B10")),
      state: t("K10"),
      stateCode: after(/^STATE CODE-?\s*/i, t("B8")),
      sacCode: t("C11"),
      bankBeneficiary: t("F40"),
      bankAccountNo: t("F41"),
      bankIfsc: t("F42"),
      bankName: t("F43"),
      invoicePrefix: parsedNo?.prefix ?? "INV",
      transporterShortName: lines[0]?.tptr ?? null,
    },
    buyer: {
      billingName: t("G3") ?? "",
      addressLines: buyerAddress,
      gstin: after(/^GSTN*:?\s*/i, t("G6")),
      pan: after(/^PAN:\s*/i, t("G7")),
      state: after(/^STATE:\s*/i, t("G8")),
      stateCode: after(/^STATE CODE:\s*/i, t("G9")),
      handlingLabel: lines[0]?.handling ?? null,
    },
    number,
    fy: parsedNo?.fy ?? null,
    seq: parsedNo?.seq ?? null,
    invoiceDate: toDate(ws.getCell("J3").value)!,
    period: t("J6") ?? "",
    placeOfSupply: t("K10") ?? "",
    lines,
    vins: vinWs ? readVinSheet(vinWs) : [],
    signature: media?.buffer ? { buffer: Buffer.from(media.buffer as unknown as ArrayBuffer), mime: `image/${media.extension}` } : null,
  };
}
