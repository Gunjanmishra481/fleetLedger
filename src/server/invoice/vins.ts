// Client VIN sheets: parse (uploaded .xlsx or pasted rows) and match to trips by LR NO.
import ExcelJS from "exceljs";
import { readVinSheet, type VinRow } from "./reference";

/** Column order of the reference "VIN DETAILS" sheet, used when pasted rows have no header. */
export const VIN_HEADERS = [
  "VIN NO", "MODEL", "MANUFACTURER (OEM)", "Region", "Dealer Code", "Dealer Name", "Dealer Location", "INVOICE DATE ",
  "INVOICE NUMBER ", "Lot No", "LOAF NO", "LAST MILE TPT Name", "CARRIER NO", "DISP DATE", "LR NO",
];

/** Reads VIN rows from the first sheet that has a "VIN NO" header (or a sheet named VIN DETAILS). */
export async function parseVinWorkbook(data: ArrayBuffer | Buffer): Promise<VinRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
  const sheets = [wb.getWorksheet("VIN DETAILS"), ...wb.worksheets].filter((w): w is ExcelJS.Worksheet => !!w);
  for (const ws of sheets) {
    const rows = readVinSheet(ws);
    if (rows.length) return rows;
  }
  return [];
}

/** Rows copied from Excel and pasted (tab-separated). The header row is optional. */
export function parseVinText(text: string): VinRow[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const cells = lines.map((l) => (l.includes("\t") ? l.split("\t") : l.split(/\s{2,}|,/)));
  const hasHeader = cells[0].some((c) => /^\s*VIN( NO)?\s*$/i.test(c));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("VIN DETAILS");
  if (!hasHeader) ws.addRow(VIN_HEADERS);
  for (const row of cells) ws.addRow(row.map((c) => c.trim()));
  return readVinSheet(ws);
}

export type MatchTrip = { id: number; lrNo: string; regNo: string | null; carsCount: number };
export type TripMatch = {
  tripId: number;
  lrNo: string;
  vins: VinRow[];
  warnings: string[];
  ok: boolean;
};
export type VinMatchReport = {
  trips: TripMatch[];
  unknownLr: { lrNo: string; vins: number }[];
  duplicateVins: string[];
  takenElsewhere: { vin: string; lrNo: string }[];
  totalRows: number;
  matchedRows: number;
};

/**
 * Matches VIN rows to the selected trips by LR NO and reports: LRs not on this invoice,
 * carrier no. different from the trip's trailer, VIN count different from the trip's car count,
 * VINs repeated in the sheet, and VINs already recorded on another trip.
 */
export function matchVins(
  trips: readonly MatchTrip[],
  rows: readonly VinRow[],
  existing: ReadonlyMap<string, { tripId: number; lrNo: string }> = new Map(),
): VinMatchReport {
  const byLr = new Map(trips.map((t) => [t.lrNo.toUpperCase(), t]));
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(r.vin, (seen.get(r.vin) ?? 0) + 1);
  const duplicateVins = [...seen].filter(([, n]) => n > 1).map(([v]) => v);

  const perTrip = new Map<number, VinRow[]>();
  const unknown = new Map<string, number>();
  let matchedRows = 0;
  for (const r of rows) {
    const t = r.lrNo ? byLr.get(r.lrNo.toUpperCase()) : undefined;
    if (!t) {
      const key = r.lrNo ?? "(blank)";
      unknown.set(key, (unknown.get(key) ?? 0) + 1);
      continue;
    }
    matchedRows++;
    perTrip.set(t.id, [...(perTrip.get(t.id) ?? []), r]);
  }

  const takenElsewhere: VinMatchReport["takenElsewhere"] = [];
  const result: TripMatch[] = trips.map((t) => {
    const vins = perTrip.get(t.id) ?? [];
    const warnings: string[] = [];
    if (!vins.length) warnings.push("No VINs for this LR on the sheet");
    else if (vins.length !== t.carsCount) warnings.push(`${vins.length} VINs on the sheet, ${t.carsCount} cars on the trip`);
    const carriers = [...new Set(vins.map((v) => v.carrierNo).filter((c): c is string => !!c))];
    for (const c of carriers) {
      if (t.regNo && c !== t.regNo) warnings.push(`Carrier ${c} on the sheet, trailer ${t.regNo} on the trip`);
    }
    if (!t.regNo && carriers.length) warnings.push(`Trip has no trailer; the sheet says ${carriers.join(", ")}`);
    const dup = vins.filter((v) => duplicateVins.includes(v.vin));
    if (dup.length) warnings.push(`${dup.length} VIN${dup.length > 1 ? "s" : ""} appear more than once`);
    for (const v of vins) {
      const other = existing.get(v.vin);
      if (other && other.tripId !== t.id) {
        takenElsewhere.push({ vin: v.vin, lrNo: other.lrNo });
        warnings.push(`VIN ${v.vin} is already recorded on LR ${other.lrNo}`);
      }
    }
    return { tripId: t.id, lrNo: t.lrNo, vins, warnings, ok: warnings.length === 0 };
  });

  return {
    trips: result,
    unknownLr: [...unknown].map(([lrNo, n]) => ({ lrNo, vins: n })),
    duplicateVins,
    takenElsewhere,
    totalRows: rows.length,
    matchedRows,
  };
}
