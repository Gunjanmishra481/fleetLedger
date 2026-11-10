// Generates src/server/invoice/layout.json from the reference invoice (tests/fixtures/invoices/JKTI_INV_108.xlsx).
// The builder renders from this file, so the Excel output follows the reference exactly.
// Re-run after replacing the reference:  node tests/tools/extract-invoice-layout.cjs
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const REF = path.resolve(__dirname, "../fixtures/invoices/JKTI_INV_108.xlsx");
const OUT = path.resolve(__dirname, "../../src/server/invoice/layout.json");

// Cells whose content comes from data (company, client, invoice, lines, totals). Everything else
// in the header/footer is a static label and is copied as-is.
const DATA_CELLS = new Set([
  "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "C11",
  "G3", "G4", "G5", "G6", "G7", "G8", "G9",
  "J3", "J4", "J5", "J6", "K10",
  "F33", "K33", "K34", "K35", "K36", "K37", "K38", "C37",
  "F40", "F41", "F42", "F43", "J40",
]);
const FIRST_LINE_ROW = 14;
const LINE_CAPACITY_LAST_ROW = 32; // the reference's SUM ranges run F14:F32
const TOTALS_FIRST_ROW = 33;

const clean = (o) => JSON.parse(JSON.stringify(o ?? {}));

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(REF);
  const inv = wb.getWorksheet("INVOICE");
  const vin = wb.getWorksheet("VIN DETAILS");

  const sheetMeta = (ws) => ({
    columns: ws.columns.map((c) => ({ letter: c.letter, width: c.width ?? null })),
    rowHeights: Object.fromEntries(
      Array.from({ length: ws.rowCount }, (_, i) => i + 1)
        .map((r) => [r, ws.getRow(r).height])
        .filter(([, h]) => h),
    ),
    merges: ws.model.merges,
    pageSetup: clean(ws.pageSetup),
    views: clean(ws.views).map(({ activeCell, ...v }) => v),
    properties: clean(ws.properties),
  });

  // Merged ranges -> master address, so only masters get values.
  const masterOf = {};
  for (const m of inv.model.merges) {
    const [a, b] = m.split(":");
    const ca = inv.getCell(a), cb = inv.getCell(b);
    for (let r = ca.row; r <= cb.row; r++) for (let c = ca.col; c <= cb.col; c++) masterOf[inv.getCell(r, c).address] = a;
  }

  const cellsOf = (ws, rows, { values }) => {
    const out = [];
    for (const r of rows) {
      ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
        const style = clean(cell.style);
        const hasStyle = Object.keys(style).length > 0;
        const isMaster = !masterOf[cell.address] || masterOf[cell.address] === cell.address;
        let value = null;
        if (values && isMaster && !DATA_CELLS.has(cell.address) && cell.value !== null && cell.value !== undefined) {
          value = cell.value instanceof Date ? { date: cell.value.toISOString() } : cell.value;
        }
        if (hasStyle || value !== null) out.push({ address: cell.address, row: cell.row, col: cell.col, style, value });
      });
    }
    return out;
  };

  const headerRows = Array.from({ length: FIRST_LINE_ROW - 1 }, (_, i) => i + 1);
  const footerRows = Array.from({ length: inv.rowCount - LINE_CAPACITY_LAST_ROW }, (_, i) => LINE_CAPACITY_LAST_ROW + 1 + i);
  // Every row of the line area (14..32) with every styled cell, as the reference has it:
  // filled rows (14..28), empty bordered rows (29..31) and the closing row (32).
  const lineRowStyles = {};
  let referenceLineCount = 0;
  for (let r = FIRST_LINE_ROW; r <= LINE_CAPACITY_LAST_ROW; r++) {
    const styles = {};
    inv.getRow(r).eachCell({ includeEmpty: true }, (c) => {
      const st = clean(c.style);
      if (Object.keys(st).length) styles[c.address.replace(/\d+/, "")] = st;
    });
    lineRowStyles[r] = styles;
    if (inv.getCell(`C${r}`).value) referenceLineCount = r - FIRST_LINE_ROW + 1;
  }

  const image = inv.getImages()[0];
  const anchor = (a) => a && { nativeCol: a.nativeCol, nativeColOff: a.nativeColOff, nativeRow: a.nativeRow, nativeRowOff: a.nativeRowOff };

  const vinHeader = [];
  vin.getRow(1).eachCell({ includeEmpty: false }, (c) => vinHeader.push({ col: c.col, value: c.value, style: clean(c.style) }));
  const vinRowStyle = {};
  vin.getRow(2).eachCell({ includeEmpty: false }, (c) => (vinRowStyle[c.col] = clean(c.style)));

  const layout = {
    source: "tests/fixtures/invoices/JKTI_INV_108.xlsx",
    generatedBy: "tests/tools/extract-invoice-layout.cjs",
    invoice: {
      ...sheetMeta(inv),
      firstLineRow: FIRST_LINE_ROW,
      lineCapacityLastRow: LINE_CAPACITY_LAST_ROW,
      totalsFirstRow: TOTALS_FIRST_ROW,
      headerCells: cellsOf(inv, headerRows, { values: true }),
      footerCells: cellsOf(inv, footerRows, { values: true }),
      lineRowStyles,
      referenceLineCount, // rows from 14 that hold lines in the reference (15)
      blankLineRow: FIRST_LINE_ROW + referenceLineCount, // first empty bordered row (29)
      signature: image && { tl: anchor(image.range.tl), br: anchor(image.range.br), editAs: image.range.editAs },
    },
    vinDetails: { ...sheetMeta(vin), header: vinHeader, rowStyle: vinRowStyle },
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(layout, null, 1) + "\n");
  console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${layout.invoice.headerCells.length} header cells, ${layout.invoice.footerCells.length} footer cells, ${referenceLineCount} line rows, image ${!!image}`);
})();
