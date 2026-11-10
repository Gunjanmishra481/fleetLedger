// Invoice maths, numbering, amount in words and VIN parsing/matching.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { amountInWords, computeInvoice } from "@/server/invoice/maths";
import { matchVins, parseVinText } from "@/server/invoice/vins";
import { nextInvoiceNo } from "@/server/services/invoice";
import { fyCode, fyPeriod } from "@/lib/fy";
import { rupeesToPaise as p } from "@/lib/money";

const db = new PrismaClient();
afterAll(async () => {
  await db.invoice.deleteMany({ where: { createdBy: "numbering-test" } });
  await db.consignor.deleteMany({ where: { name: "ZZNUM" } });
  await db.invoiceSeries.deleteMany({ where: { fy: "3031" } });
  await db.$disconnect();
});

describe("computeInvoice()", () => {
  it("reproduces invoice 108: IGST 18% across states, round off -0.14", () => {
    const t = computeInvoice({ amounts: [p(436289.1)], sellerStateCode: "24", buyerStateCode: "07" });
    expect(t).toEqual({ subtotal: p(436289.1), igst: p(78532.04), cgst: 0, sgst: 0, roundOff: -14, total: p(514821), intraState: false });
  });
  it("splits CGST 9% + SGST 9% inside the state, comparing codes numerically", () => {
    const t = computeInvoice({ amounts: [p(15871), p(28835)], sellerStateCode: "024", buyerStateCode: "24" });
    expect(t.intraState).toBe(true);
    expect(t.igst).toBe(0);
    expect(t.cgst).toBe(p(4023.54)); // 44706 x 9% = 4023.54
    expect(t.sgst).toBe(p(4023.54));
    expect(t.total).toBe(p(52753)); // 52753.08 -> 52753
    expect(t.roundOff).toBe(-8);
  });
  it("rounds up at 50 paise and uses IGST when the client has no state code", () => {
    const t = computeInvoice({ amounts: [p(100.25)], sellerStateCode: "24", buyerStateCode: null });
    expect(t.igst).toBe(p(18.05)); // 18.045 -> 18.05
    expect(t.total).toBe(p(118)); // 118.30 -> 118
    expect(computeInvoice({ amounts: [p(100.42)], sellerStateCode: "24", buyerStateCode: "07" }).total).toBe(p(119)); // 118.50 -> 119
  });
  it("refuses fractional paise", () => {
    expect(() => computeInvoice({ amounts: [10.5], sellerStateCode: "24", buyerStateCode: "07" })).toThrow();
  });
});

describe("amountInWords()", () => {
  it("uses the Indian system", () => {
    expect(amountInWords(514821)).toBe("Five Lakh Fourteen Thousand Eight Hundred Twenty One Only");
    expect(amountInWords(12_34_56_789)).toBe("Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Only");
    expect(amountInWords(100000)).toBe("One Lakh Only");
    expect(amountInWords(1015)).toBe("One Thousand Fifteen Only");
    expect(amountInWords(90)).toBe("Ninety Only");
    expect(amountInWords(0)).toBe("Zero Only");
    expect(() => amountInWords(1.5)).toThrow();
  });
});

describe("financial year", () => {
  it("runs April to March", () => {
    expect(fyCode(new Date(Date.UTC(2026, 3, 1)))).toBe("2627");
    expect(fyCode(new Date(Date.UTC(2027, 2, 31)))).toBe("2627");
    expect(fyCode(new Date(Date.UTC(2026, 2, 31)))).toBe("2526");
    expect(fyPeriod(new Date(Date.UTC(2026, 10, 5)))).toBe("2026-2027");
  });
});

describe("nextInvoiceNo()", () => {
  it("continues FY 2026-27 after 108 (migration 0004)", async () => {
    expect(await nextInvoiceNo(db, new Date(Date.UTC(2026, 10, 10)))).toEqual({ number: "MKLAMD2627109", fy: "2627", seq: 109 });
  });
  it("starts a new FY at its start number, then counts up from the highest used", async () => {
    const d = new Date(Date.UTC(2030, 5, 1));
    expect((await nextInvoiceNo(db, d)).number).toBe("MKLAMD30311");
    await db.invoiceSeries.create({ data: { fy: "3031", startNo: 50 } });
    expect((await nextInvoiceNo(db, d)).seq).toBe(50);
    const c = await db.consignor.create({ data: { name: "ZZNUM", billingName: "ZZ", addressLines: [] } });
    await db.invoice.create({
      data: { number: "MKLAMD303175", fy: "3031", seq: 75, consignorId: c.id, invoiceDate: d, period: "2030-2031", placeOfSupply: "Gujarat", subtotal: 0, igst: 0, cgst: 0, sgst: 0, roundOff: 0, total: 0, status: "CANCELLED", createdBy: "numbering-test" },
    });
    expect((await nextInvoiceNo(db, d)).number).toBe("MKLAMD303176"); // cancelled numbers stay used
  });
});

describe("VIN sheets", () => {
  const header = "VIN NO\tMODEL\tMANUFACTURER (OEM)\tRegion\tDealer Code\tDealer Name\tDealer Location\tINVOICE DATE \tINVOICE NUMBER \tLot No\tLOAF NO\tLAST MILE TPT Name\tCARRIER NO\tDISP DATE\tLR NO";
  const row = (vin: string, carrier: string, lr: string) => `${vin}\tAura\tHyundai\tWest\tW3273\tP T MOTORS\tHalol\t12/10/2026\t263310229063\t2010262\t20\tMAHAKAL\t${carrier}\t28-10-2026\t${lr}`;

  it("parses pasted rows with or without the header", () => {
    const withHeader = parseVinText([header, row("VIN1", "NL01N3650", "1685")].join("\n"));
    const bare = parseVinText(row("VIN1", "nl01 n3650", "1685"));
    expect(withHeader).toHaveLength(1);
    expect(bare[0]).toEqual(withHeader[0]);
    expect(bare[0]).toMatchObject({ vin: "VIN1", carrierNo: "NL01N3650", lrNo: "1685", oemInvoiceDate: "12/10/2026", dispatchDate: new Date(Date.UTC(2026, 9, 28)) });
  });

  it("matches by LR and reports every kind of mismatch", () => {
    const rows = parseVinText(
      [header, row("A1", "NL01N3650", "1685"), row("A2", "NL01N3650", "1685"), row("B1", "NL01N3653", "1706"), row("B1", "NL01N3653", "1706"), row("C1", "NL01AL1659", "9999"), row("D1", "NL01AL1659", "1686")].join("\n"),
    );
    const report = matchVins(
      [
        { id: 1, lrNo: "1685", regNo: "NL01N3650", carsCount: 2 },
        { id: 2, lrNo: "1706", regNo: "NL01AL3653", carsCount: 2 },
        { id: 3, lrNo: "1686", regNo: "NL01AL1659", carsCount: 6 },
        { id: 4, lrNo: "1700", regNo: "NL01AL2453", carsCount: 6 },
      ],
      rows,
      new Map([["D1", { tripId: 99, lrNo: "1500" }]]),
    );
    const by = (lr: string) => report.trips.find((t) => t.lrNo === lr)!;
    expect(by("1685").ok).toBe(true);
    expect(by("1706").warnings).toEqual(["Carrier NL01N3653 on the sheet, trailer NL01AL3653 on the trip", "2 VINs appear more than once"]);
    expect(by("1686").warnings).toEqual(["1 VINs on the sheet, 6 cars on the trip", "VIN D1 is already recorded on LR 1500"]);
    expect(by("1700").warnings).toEqual(["No VINs for this LR on the sheet"]);
    expect(report.unknownLr).toEqual([{ lrNo: "9999", vins: 1 }]);
    expect(report.duplicateVins).toEqual(["B1"]);
    expect(report.takenElsewhere).toEqual([{ vin: "D1", lrNo: "1500" }]);
    expect(report).toMatchObject({ totalRows: 6, matchedRows: 5 });
  });
});
