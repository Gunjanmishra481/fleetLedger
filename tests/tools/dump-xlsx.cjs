// Dev helper: prints the full structure of an .xlsx (values, formulas, styles, merges, images).
const ExcelJS = require("exceljs");
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  const only = process.argv[3];
  console.log("creator:", wb.creator, "| sheets:", wb.worksheets.map((w) => `${w.name} (${w.rowCount}x${w.columnCount})`).join(", "));
  console.log("media:", wb.model.media?.map((m) => `${m.name}.${m.extension} ${m.buffer?.length}b`).join(", "));
  for (const ws of wb.worksheets) {
    if (only && ws.name !== only) continue;
    console.log(`\n===== SHEET "${ws.name}" state=${ws.state}`);
    console.log("pageSetup:", JSON.stringify(ws.pageSetup));
    console.log("headerFooter:", JSON.stringify(ws.headerFooter));
    console.log("views:", JSON.stringify(ws.views));
    console.log("props:", JSON.stringify(ws.properties));
    console.log("merges:", JSON.stringify(ws.model.merges));
    console.log("cols:", ws.columns?.map((c, i) => `${c.letter}=${c.width ?? "-"}${c.hidden ? "(h)" : ""}`).join(" "));
    console.log("images:", JSON.stringify(ws.getImages().map((i) => ({ imageId: i.imageId, range: { tl: i.range.tl && { col: i.range.tl.nativeCol, colOff: i.range.tl.nativeColOff, row: i.range.tl.nativeRow, rowOff: i.range.tl.nativeRowOff }, br: i.range.br && { col: i.range.br.nativeCol, colOff: i.range.br.nativeColOff, row: i.range.br.nativeRow, rowOff: i.range.br.nativeRowOff }, ext: i.range.ext, editAs: i.range.editAs } }))));
    const rowFilter = process.argv[4];
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      if (rowFilter && !rowFilter.split(",").includes(String(r))) return;
      const cells = [];
      row.eachCell({ includeEmpty: false }, (c) => {
        const v = c.value;
        let val = v instanceof Date ? `D:${v.toISOString()}` : typeof v === "object" && v !== null ? JSON.stringify(v) : JSON.stringify(v);
        const st = c.style || {};
        const f = st.font ? `f{${[st.font.name, st.font.size, st.font.bold ? "B" : "", st.font.italic ? "I" : "", st.font.underline ? "U" : "", st.font.color?.argb].filter(Boolean).join(",")}}` : "";
        const a = st.alignment ? `a{${[st.alignment.horizontal, st.alignment.vertical, st.alignment.wrapText ? "wrap" : ""].filter(Boolean).join(",")}}` : "";
        const b = st.border ? `b{${["top", "left", "bottom", "right"].map((k) => (st.border[k]?.style ? k[0] + ":" + st.border[k].style : "")).filter(Boolean).join(",")}}` : "";
        const n = st.numFmt ? `n{${st.numFmt}}` : "";
        const fill = st.fill && st.fill.fgColor ? `fill{${st.fill.fgColor.argb ?? st.fill.fgColor.theme}}` : "";
        cells.push(`${c.address}=${val} ${f}${a}${b}${n}${fill}`.trim());
      });
      if (cells.length || row.height) console.log(`R${r} h=${row.height ?? "-"}: ${cells.join(" | ")}`);
    });
  }
})();
