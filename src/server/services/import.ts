// Excel importer for monthly loading sheets laid out like SEP-26: read -> analyse (preview) -> commit.
import ExcelJS from "exceljs";
import type { Db, DbTx } from "../db";
import { rupeesToPaise, type Paise } from "@/lib/money";
import { NO_LR_PREFIX, compute, destinationKey, monthKeyOf, type IncompleteNote } from "./trip";

// ---------- normalisation (shared with masters) ----------

/** Upper-case, single spaces, "OCPL(DETROJ)" / "OCPL ( DETROJ )" -> "OCPL (DETROJ)". */
export function normaliseName(s: string): string {
  return s
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\(\s*/g, " (")
    .replace(/\s*\)/g, ")")
    .trim();
}

/** Registration numbers: upper-case, no spaces or dashes. */
export function normaliseRegNo(s: string): string {
  return s.toUpperCase().replace(/[\s-]+/g, "");
}

/** "RAJKOT + JUNAGARH" -> ["RAJKOT", "JUNAGARH"] (order kept, blanks dropped). */
export function splitStops(s: string): string[] {
  return s.split("+").map(normaliseName).filter(Boolean);
}

/** Known spellings seen in the sheets. Masters' alias tables extend these. */
export const DEFAULT_DRIVER_ALIASES: Record<string, string> = { JAWAHIR: "JAVAHIR" };
export const DEFAULT_LOCATION_ALIASES: Record<string, string> = {
  VADODRA: "VADODARA",
  AHM: "AHMEDABAD",
  "PIPAVA PORT": "PIPAVAV PORT",
};

// ---------- reading ----------

export type RawRow = {
  rowNo: number;
  serial: number | null;
  date: Date | null;
  trailer: string;
  driver: string;
  lr: string;
  from: string;
  destination: string;
  cars: number | null;
  diesel: number | null;
  rate: number | null;
  pod: number | null;
  maint: number | null;
  trip: number | null;
  freight: number | null;
  remark: string;
  dealer: string;
};

const HEADERS: Record<string, keyof Omit<RawRow, "rowNo">> = {
  F: "serial",
  "S NO": "serial",
  "SR NO": "serial",
  DATE: "date",
  "TRAILER NO": "trailer",
  DRIVER: "driver",
  "LR NO": "lr",
  FROM: "from",
  DESTINATION: "destination",
  "NO CAR": "cars",
  DIESEL: "diesel",
  "RATE/LTR": "rate",
  POD: "pod",
  MAINT: "maint",
  TRIP: "trip",
  "TRIP REVENUE": "freight",
  REMARK: "remark",
  DEALER: "dealer",
};
const NUMERIC = new Set(["serial", "cars", "diesel", "rate", "pod", "maint", "trip", "freight"]);

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return v.result ?? null;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
    return null; // shared formula with no cached result, errors
  }
  return v;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[₹,\s]/g, ""));
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000); // Excel serial
  if (typeof v === "string") {
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(v.trim());
    if (m) {
      const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
      return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
    }
  }
  return null;
}

export async function readSheet(
  data: ArrayBuffer | Buffer,
  sheetName?: string,
): Promise<{ sheetName: string; rows: RawRow[] }> {
  const wb = new ExcelJS.Workbook();
  // exceljs' Buffer type predates Node's generic Buffer; the runtime accepts either.
  await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
  const ws =
    (sheetName && wb.getWorksheet(sheetName)) ||
    wb.worksheets.find((w) => /^[A-Z]{3}-\d{2}$/i.test(w.name.trim())) ||
    wb.worksheets.find((w) => w.rowCount > 0);
  if (!ws) throw new Error("The workbook has no data sheet");

  // Find the header row (first row containing "TRAILER NO") and map columns by name.
  let headerRow = 0;
  const cols = new Map<number, keyof Omit<RawRow, "rowNo">>();
  ws.eachRow((row, n) => {
    if (headerRow) return;
    const found = new Map<number, keyof Omit<RawRow, "rowNo">>();
    row.eachCell((c, col) => {
      const h = String(cellValue(c.value) ?? "").toUpperCase().replace(/\s+/g, " ").trim();
      if (HEADERS[h]) found.set(col, HEADERS[h]);
    });
    if ([...found.values()].includes("trailer")) {
      headerRow = n;
      for (const [k, v] of found) cols.set(k, v);
    }
  });
  if (!headerRow) throw new Error(`Sheet "${ws.name}" has no "TRAILER NO" header row`);

  const rows: RawRow[] = [];
  ws.eachRow((row, n) => {
    if (n <= headerRow) return;
    const r: RawRow = {
      rowNo: n, serial: null, date: null, trailer: "", driver: "", lr: "", from: "", destination: "",
      cars: null, diesel: null, rate: null, pod: null, maint: null, trip: null, freight: null, remark: "", dealer: "",
    };
    let any = false;
    for (const [col, key] of cols) {
      const v = cellValue(row.getCell(col).value);
      if (v !== null && v !== "") any = true;
      if (key === "date") r.date = toDate(v);
      else if (NUMERIC.has(key)) (r[key] as number | null) = toNumber(v);
      else (r[key] as string) = v === null ? "" : String(v).trim();
    }
    if (any) rows.push(r);
  });
  return { sheetName: ws.name, rows };
}

// ---------- analysis (preview) ----------

export type ParsedTrip = {
  rowNo: number;
  serialNo: number;
  tripDate: Date;
  monthKey: string;
  lrNo: string;
  regNo: string | null;
  driverName: string | null;
  originName: string | null;
  stopNames: string[];
  carsCount: number;
  dieselL: number;
  dieselRate: Paise;
  podCharge: Paise;
  maintenance: Paise;
  driverAllowance: Paise;
  freight: Paise;
  billingStatus: "UNBILLED" | "INVOICED";
  dealerName: string | null;
  notes: string | null;
  /** What was blank or unreadable in the sheet row; the trip is flagged until fixed. */
  incomplete: IncompleteNote[];
};

export type IssueKind =
  | "ERROR"
  | "INCOMPLETE"
  | "SKIPPED_EMPTY"
  | "MISSING_DRIVER"
  | "DUPLICATE_LR"
  | "LR_EXISTS"
  | "DUPLICATE_SERIAL"
  | "ZERO_COST"
  | "ALIAS";
export type Issue = { rowNo: number | null; kind: IssueKind; message: string };

export type Preview = {
  sheetName: string;
  trips: ParsedTrip[];
  issues: Issue[];
  months: string[];
  newDrivers: string[];
  newVehicles: string[];
  newLocations: { name: string; kind: "LOADING_POINT" | "DESTINATION" }[];
  newDealers: string[];
  aliasesApplied: { kind: "DRIVER" | "LOCATION"; from: string; to: string }[];
  totals: { trips: number; cars: number; dieselL: number; freight: Paise; totalCost: Paise; profit: Paise };
};

type Masters = {
  drivers: Set<string>;
  driverAliases: Map<string, string>;
  vehicles: Set<string>;
  locations: Set<string>;
  locationAliases: Map<string, string>;
  dealers: Set<string>;
  lrNos: Set<string>;
};

async function loadMasters(db: DbTx): Promise<Masters> {
  const [drivers, dAliases, vehicles, locations, lAliases, dealers, trips] = await Promise.all([
    db.driver.findMany({ select: { name: true } }),
    db.driverAlias.findMany({ select: { alias: true, driver: { select: { name: true } } } }),
    db.vehicle.findMany({ select: { regNo: true } }),
    db.location.findMany({ select: { name: true } }),
    db.locationAlias.findMany({ select: { alias: true, location: { select: { name: true } } } }),
    db.dealer.findMany({ select: { name: true } }),
    db.trip.findMany({ select: { lrNo: true } }),
  ]);
  return {
    drivers: new Set(drivers.map((d) => d.name)),
    driverAliases: new Map([
      ...Object.entries(DEFAULT_DRIVER_ALIASES),
      ...dAliases.map((a) => [a.alias, a.driver.name] as [string, string]),
    ]),
    vehicles: new Set(vehicles.map((v) => v.regNo)),
    locations: new Set(locations.map((l) => l.name)),
    locationAliases: new Map([
      ...Object.entries(DEFAULT_LOCATION_ALIASES),
      ...lAliases.map((a) => [a.alias, a.location.name] as [string, string]),
    ]),
    dealers: new Set(dealers.map((d) => d.name)),
    lrNos: new Set(trips.map((t) => t.lrNo)),
  };
}

function money(v: number | null): Paise {
  return v === null ? 0 : rupeesToPaise(v);
}

export async function analyse(db: DbTx, sheet: { sheetName: string; rows: RawRow[] }): Promise<Preview> {
  const m = await loadMasters(db);
  const issues: Issue[] = [];
  const trips: ParsedTrip[] = [];
  const aliasSeen = new Map<string, { kind: "DRIVER" | "LOCATION"; from: string; to: string }>();
  const seenLr = new Map<string, number>();
  const seenSerial = new Map<string, number>();
  const newDrivers = new Set<string>();
  const newVehicles = new Set<string>();
  const newLocations = new Map<string, "LOADING_POINT" | "DESTINATION">();
  const newDealers = new Set<string>();

  const location = (raw: string, kind: "LOADING_POINT" | "DESTINATION") => {
    const n = normaliseName(raw);
    const to = m.locationAliases.get(n);
    if (to) aliasSeen.set(`L:${n}`, { kind: "LOCATION", from: n, to });
    const name = to ?? n;
    if (!m.locations.has(name) && !newLocations.has(name)) newLocations.set(name, kind);
    return name;
  };

  // Blank dates take the date of the row above (sheets run in date order); rows before the
  // first dated row take the first date in the sheet.
  const firstDate = sheet.rows.find((r) => r.date)?.date ?? null;
  let lastDate: Date | null = firstDate;
  let skipped = 0;

  for (const r of sheet.rows) {
    // Pre-numbered template rows (serial, prefilled rate/POD or formulas only) are not trips.
    const hasTrip = !!(r.trailer || r.lr || r.destination || r.from || r.driver || (r.freight && r.freight > 0) || (r.cars && r.cars > 0));
    if (!hasTrip) {
      skipped++;
      continue;
    }
    if (!r.date && !lastDate) {
      issues.push({ rowNo: r.rowNo, kind: "ERROR", message: "No readable DATE in this row or any row above it" });
      continue;
    }

    const missing: IncompleteNote[] = [];
    // One note per field: the first (most specific) reason wins.
    const blank = (field: string, note: string) => {
      if (!missing.some((x) => x.field === field)) missing.push({ field, note });
    };
    const num = (k: "cars" | "diesel" | "rate" | "pod" | "maint" | "trip" | "freight", field: string) => {
      const v = r[k];
      if (Number.isNaN(v)) {
        blank(field, `${field} was not a number in the sheet`);
        return null;
      }
      return v;
    };

    let tripDate = r.date;
    if (!tripDate) {
      tripDate = lastDate!;
      blank("date", `date was blank; used ${tripDate.toISOString().slice(0, 10)} from the row above`);
    }
    lastDate = tripDate;

    let regNo: string | null = null;
    if (r.trailer) {
      regNo = normaliseRegNo(r.trailer);
      if (!m.vehicles.has(regNo)) newVehicles.add(regNo);
    } else blank("trailer", "trailer was blank");

    let driverName: string | null = null;
    if (r.driver) {
      const n = normaliseName(r.driver);
      const to = m.driverAliases.get(n);
      if (to) aliasSeen.set(`D:${n}`, { kind: "DRIVER", from: n, to });
      driverName = to ?? n;
      if (!m.drivers.has(driverName)) newDrivers.add(driverName);
    } else {
      issues.push({ rowNo: r.rowNo, kind: "MISSING_DRIVER", message: `No driver on ${regNo ?? "a row with no trailer"}` });
    }

    let originName: string | null = null;
    if (r.from) originName = location(r.from, "LOADING_POINT");
    else blank("loading point", "FROM was blank");
    const stopNames = r.destination ? [...new Set(splitStops(r.destination).map((x) => location(x, "DESTINATION")))] : [];
    if (!stopNames.length) blank("destination", "DESTINATION was blank");

    let dealerName: string | null = null;
    if (r.dealer) {
      dealerName = normaliseName(r.dealer);
      if (!m.dealers.has(dealerName)) newDealers.add(dealerName);
    }

    const cars = num("cars", "cars");
    if (cars === null || cars <= 0) blank("cars", "NO CAR was blank");
    const freight = num("freight", "freight");
    if (freight === null || freight <= 0) blank("freight", "Trip Revenue was blank");
    const diesel = num("diesel", "diesel");
    const rate = num("rate", "diesel rate");
    const pod = num("pod", "POD");
    const maint = num("maint", "maintenance");
    const allowance = num("trip", "allowance");

    const monthKey = monthKeyOf(tripDate);
    let lrNo = r.lr.toUpperCase().replace(/s+/g, ""); // "1272 -a" -> "1272-A"
    if (!lrNo) {
      lrNo = `${NO_LR_PREFIX}${monthKey.slice(2).replace("-", "")}-R${r.rowNo}`;
      blank("LR no.", `LR NO was blank; given placeholder ${lrNo}`);
    }
    let notes: string | null = r.remark && r.remark.toUpperCase() !== "INVOICE DONE" ? r.remark : null;
    const firstRow = seenLr.get(lrNo);
    if (firstRow !== undefined) {
      // Keep the trip (it is real revenue) but give it a unique LR so the unique rule holds.
      const renamed = `${lrNo}-DUP`;
      issues.push({
        rowNo: r.rowNo,
        kind: "DUPLICATE_LR",
        message: `LR ${lrNo} already used on row ${firstRow}; imported as ${renamed}`,
      });
      notes = [notes, `Sheet LR ${lrNo} duplicated row ${firstRow}`].filter(Boolean).join("; ");
      lrNo = renamed;
    } else {
      seenLr.set(lrNo, r.rowNo);
    }
    if (m.lrNos.has(lrNo)) {
      issues.push({ rowNo: r.rowNo, kind: "LR_EXISTS", message: `LR ${lrNo} is already in the database` });
    }

    const serialNo = r.serial && Number.isInteger(r.serial) ? r.serial : trips.length + 1;
    const sKey = `${monthKey}:${serialNo}`;
    if (seenSerial.has(sKey)) {
      issues.push({ rowNo: r.rowNo, kind: "DUPLICATE_SERIAL", message: `Serial ${serialNo} also on row ${seenSerial.get(sKey)}` });
    } else {
      seenSerial.set(sKey, r.rowNo);
    }

    const t: ParsedTrip = {
      rowNo: r.rowNo,
      serialNo,
      tripDate,
      monthKey,
      lrNo,
      regNo,
      driverName,
      originName,
      stopNames,
      carsCount: cars !== null && cars > 0 ? Math.round(cars) : 0,
      dieselL: diesel ?? 0,
      dieselRate: money(rate),
      podCharge: money(pod),
      maintenance: money(maint),
      driverAllowance: money(allowance),
      freight: money(freight),
      billingStatus: /INVOICE/i.test(r.remark) ? "INVOICED" : "UNBILLED",
      dealerName,
      notes,
      incomplete: missing,
    };
    if (missing.length) {
      issues.push({ rowNo: r.rowNo, kind: "INCOMPLETE", message: `Imported, fix later: ${missing.map((x) => x.note).join("; ")}` });
    }
    if (compute(t).totalCost === 0 && t.freight > 0) {
      issues.push({
        rowNo: r.rowNo,
        kind: "ZERO_COST",
        message: `${regNo ?? "No trailer"} ${originName ?? "?"} -> ${stopNames.join(" + ") || "?"} has revenue but no cost`,
      });
    }
    trips.push(t);
  }
  if (skipped) issues.push({ rowNo: null, kind: "SKIPPED_EMPTY", message: `${skipped} empty row${skipped > 1 ? "s" : ""} skipped (no trailer, LR, places or amounts)` });

  for (const a of aliasSeen.values()) {
    issues.push({ rowNo: null, kind: "ALIAS", message: `${a.kind === "DRIVER" ? "Driver" : "Location"} ${a.from} merged into ${a.to}` });
  }

  const totals = trips.reduce(
    (acc, t) => {
      const c = compute(t);
      acc.trips += 1;
      acc.cars += t.carsCount;
      acc.dieselL += t.dieselL;
      acc.freight += t.freight;
      acc.totalCost += c.totalCost;
      acc.profit += c.profit;
      return acc;
    },
    { trips: 0, cars: 0, dieselL: 0, freight: 0, totalCost: 0, profit: 0 },
  );

  return {
    sheetName: sheet.sheetName,
    trips,
    issues,
    months: [...new Set(trips.map((t) => t.monthKey))].sort(),
    newDrivers: [...newDrivers].sort(),
    newVehicles: [...newVehicles].sort(),
    newLocations: [...newLocations].map(([name, kind]) => ({ name, kind })).sort((a, b) => a.name.localeCompare(b.name)),
    newDealers: [...newDealers].sort(),
    aliasesApplied: [...aliasSeen.values()],
    totals,
  };
}

// ---------- commit ----------

function mode<T>(values: T[]): T {
  const counts = new Map<T, number>();
  let best = values[0];
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

export type CommitResult = { tripsCreated: number; deletedTrips: number; rateCardsCreated: number };

/**
 * Writes a previewed import in one transaction. With replaceMonths, existing trips in the
 * sheet's months are deleted first (re-import); otherwise any LR already in the DB aborts.
 */
export async function commitImport(
  db: Db,
  preview: Preview,
  opts: { user: string; replaceMonths?: boolean },
): Promise<CommitResult> {
  // Rows with errors (no usable date) are not in preview.trips; everything else imports.
  if (preview.trips.length === 0) throw new Error("Nothing to import: no row in the sheet has trip details");

  return db.$transaction(
    async (tx) => {
      let deletedTrips = 0;
      if (opts.replaceMonths) {
        deletedTrips = (await tx.trip.deleteMany({ where: { monthKey: { in: preview.months } } })).count;
      }
      const clash = await tx.trip.findFirst({ where: { lrNo: { in: preview.trips.map((t) => t.lrNo) } } });
      if (clash) throw new Error(`LR ${clash.lrNo} is already in the database (month ${clash.monthKey}). Use "replace month".`);

      // Masters
      const driverId = new Map<string, number>();
      for (const name of new Set(preview.trips.map((t) => t.driverName).filter((n): n is string => !!n))) {
        driverId.set(name, (await tx.driver.upsert({ where: { name }, create: { name }, update: {} })).id);
      }
      const locationId = new Map<string, number>();
      const kinds = new Map<string, "LOADING_POINT" | "DESTINATION">();
      for (const t of preview.trips) {
        if (t.originName) kinds.set(t.originName, "LOADING_POINT");
        for (const s of t.stopNames) if (!kinds.has(s)) kinds.set(s, "DESTINATION");
      }
      for (const [name, kind] of kinds) {
        locationId.set(name, (await tx.location.upsert({ where: { name }, create: { name, kind }, update: {} })).id);
      }
      for (const a of preview.aliasesApplied) {
        if (a.kind === "DRIVER" && driverId.has(a.to)) {
          await tx.driverAlias.upsert({ where: { alias: a.from }, create: { alias: a.from, driverId: driverId.get(a.to)! }, update: {} });
        }
        if (a.kind === "LOCATION" && locationId.has(a.to)) {
          await tx.locationAlias.upsert({
            where: { alias: a.from },
            create: { alias: a.from, locationId: locationId.get(a.to)! },
            update: {},
          });
        }
      }
      const vehicleId = new Map<string, number>();
      for (const regNo of new Set(preview.trips.map((t) => t.regNo).filter((r): r is string => !!r))) {
        vehicleId.set(regNo, (await tx.vehicle.upsert({ where: { regNo }, create: { regNo }, update: {} })).id);
      }
      const dealerId = new Map<string, number>();
      for (const name of new Set(preview.trips.map((t) => t.dealerName).filter((n): n is string => !!n))) {
        dealerId.set(name, (await tx.dealer.upsert({ where: { name }, create: { name }, update: {} })).id);
      }

      // Diesel rate: the most common non-zero rate in each month, from the 1st of that month.
      for (const mk of preview.months) {
        const rates = preview.trips.filter((t) => t.monthKey === mk && t.dieselRate > 0).map((t) => t.dieselRate);
        if (!rates.length) continue;
        const [y, mo] = mk.split("-").map(Number);
        const effectiveFrom = new Date(Date.UTC(y, mo - 1, 1));
        await tx.dieselRate.upsert({ where: { effectiveFrom }, create: { effectiveFrom, ratePaise: mode(rates) }, update: {} });
      }

      // Rate card: most common freight / diesel / allowance / POD per route, from trips that have costs.
      const routes = new Map<string, ParsedTrip[]>();
      for (const t of preview.trips) {
        // Only complete, costed trips set route standards.
        if (compute(t).totalCost === 0 || !t.originName || !t.stopNames.length || t.freight === 0) continue;
        const key = `${locationId.get(t.originName)}|${destinationKey(t.stopNames.map((s) => locationId.get(s)!))}`;
        routes.set(key, [...(routes.get(key) ?? []), t]);
      }
      let rateCardsCreated = 0;
      const firstDay = (() => {
        const [y, mo] = preview.months[0]?.split("-").map(Number) ?? [2000, 1];
        return new Date(Date.UTC(y, mo - 1, 1));
      })();
      for (const [key, ts] of routes) {
        const [originId, destKey] = key.split("|");
        const exists = await tx.rateCard.findFirst({ where: { originId: Number(originId), destinationKey: destKey } });
        if (exists) continue;
        await tx.rateCard.create({
          data: {
            originId: Number(originId),
            destinationKey: destKey,
            freight: mode(ts.map((t) => t.freight)),
            stdDieselL: mode(ts.map((t) => t.dieselL)),
            driverAllowance: mode(ts.map((t) => t.driverAllowance)),
            podCharge: mode(ts.map((t) => t.podCharge)),
            effectiveFrom: firstDay,
          },
        });
        rateCardsCreated++;
      }

      // Trips: one bulk insert, then one bulk insert of their stops (few round trips to a remote DB).
      await tx.trip.createMany({
        data: preview.trips.map((t) => {
          const c = compute(t);
          return {
            serialNo: t.serialNo,
            tripDate: t.tripDate,
            monthKey: t.monthKey,
            lrNo: t.lrNo,
            vehicleId: t.regNo ? vehicleId.get(t.regNo)! : null,
            driverId: t.driverName ? driverId.get(t.driverName)! : null,
            originId: t.originName ? locationId.get(t.originName)! : null,
            carsCount: t.carsCount,
            dieselL: t.dieselL,
            dieselRate: t.dieselRate,
            podCharge: t.podCharge,
            maintenance: t.maintenance,
            driverAllowance: t.driverAllowance,
            freight: t.freight,
            dieselAmount: c.dieselAmount,
            totalCost: c.totalCost,
            profit: c.profit,
            dealerId: t.dealerName ? dealerId.get(t.dealerName)! : null,
            billingStatus: t.billingStatus,
            notes: t.notes,
            createdBy: opts.user,
            incomplete: t.incomplete.length ? JSON.stringify(t.incomplete) : null,
          };
        }),
      });
      const tripIds = new Map(
        (await tx.trip.findMany({ where: { lrNo: { in: preview.trips.map((t) => t.lrNo) } }, select: { id: true, lrNo: true } })).map((r) => [
          r.lrNo,
          r.id,
        ]),
      );
      await tx.tripStop.createMany({
        data: preview.trips.flatMap((t) =>
          t.stopNames.map((s, i) => ({ tripId: tripIds.get(t.lrNo)!, locationId: locationId.get(s)!, seq: i + 1 })),
        ),
      });

      // Usual driver = most frequent driver on each trailer in this import.
      for (const [regNo, id] of vehicleId) {
        const names = preview.trips.filter((t) => t.regNo === regNo && t.driverName).map((t) => t.driverName!);
        if (names.length) await tx.vehicle.update({ where: { id }, data: { usualDriverId: driverId.get(mode(names)) } });
      }

      await tx.auditLog.create({
        data: {
          user: opts.user,
          entity: "Import",
          entityId: `${preview.sheetName}:${preview.months.join(",")}`,
          action: "IMPORT",
          changes: JSON.stringify({
            sheet: preview.sheetName,
            months: preview.months,
            tripsCreated: preview.trips.length,
            deletedTrips,
            rateCardsCreated,
            totals: preview.totals,
            issues: preview.issues.length,
            incompleteTrips: preview.trips.filter((t) => t.incomplete.length).length,
          }),
        },
      });

      return { tripsCreated: preview.trips.length, deletedTrips, rateCardsCreated };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}
