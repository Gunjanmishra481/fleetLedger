// Excel export of the filtered trip register in the original SEP-26 column layout.
import ExcelJS from "exceljs";
import { listTrips, parseTripFilters } from "@/server/queries/trips";
import { requireUser } from "@/server/session";
import { formatMonthKey } from "@/lib/format";

const COLUMNS: { header: string; width: number; numFmt?: string }[] = [
  { header: "F", width: 6 },
  { header: "DATE", width: 11, numFmt: "dd-mmm-yy" },
  { header: "TRAILER NO", width: 13 },
  { header: "DRIVER", width: 12 },
  { header: "LR NO", width: 10 },
  { header: "FROM", width: 16 },
  { header: "DESTINATION", width: 22 },
  { header: "NO CAR", width: 8 },
  { header: "DIESEL", width: 8 },
  { header: "Rate/ltr", width: 9, numFmt: "0.00" },
  { header: "Diesel Amount", width: 13, numFmt: "#,##0.00" },
  { header: "POD", width: 7, numFmt: "#,##0" },
  { header: "Maint", width: 8, numFmt: "#,##0" },
  { header: "TRIP", width: 8, numFmt: "#,##0" },
  { header: "Total Cost", width: 12, numFmt: "#,##0.00" },
  { header: "Trip Revenue", width: 12, numFmt: "#,##0" },
  { header: "Profit/Loss", width: 12, numFmt: "#,##0.00" },
  { header: "REMARK", width: 14 },
  { header: "DEALER", width: 12 },
];

const REMARK: Record<string, string> = { INVOICED: "INVOICE DONE", PAID: "PAID", UNBILLED: "" };
const r = (paise: number) => paise / 100; // display-only conversion for the spreadsheet

export async function GET(req: Request) {
  await requireUser();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const f = parseTripFilters(sp);
  const rows = await listTrips(f);

  const wb = new ExcelJS.Workbook();
  const sheetName = formatMonthKey(f.m).replace(" ", "-").toUpperCase().replace(/(\w{3})-\d{2}(\d{2})/, "$1-$2");
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, width: c.width, style: c.numFmt ? { numFmt: c.numFmt } : {} }));
  ws.getRow(1).font = { bold: true };

  for (const t of rows) {
    ws.addRow([
      t.serialNo,
      new Date(t.date),
      t.regNo,
      t.driver ?? "",
      /^\d+$/.test(t.lrNo) ? Number(t.lrNo) : t.lrNo,
      t.origin,
      t.destination,
      t.carsCount,
      t.dieselL,
      r(t.dieselRate),
      r(t.dieselAmount),
      r(t.podCharge),
      t.maintenance ? r(t.maintenance) : null,
      r(t.driverAllowance),
      r(t.totalCost),
      r(t.freight),
      r(t.profit),
      REMARK[t.billingStatus] ?? t.billingStatus,
      t.dealer ?? "",
    ]);
  }
  if (rows.length) {
    const first = 2;
    const last = rows.length + 1;
    const total = ws.addRow([]);
    total.getCell(7).value = "TOTAL";
    for (const col of ["H", "I", "K", "L", "M", "N", "O", "P", "Q"]) {
      ws.getCell(`${col}${total.number}`).value = { formula: `SUM(${col}${first}:${col}${last})` };
    }
    total.font = { bold: true };
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="trips-${f.m}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
