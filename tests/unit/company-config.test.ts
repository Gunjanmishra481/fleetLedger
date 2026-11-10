// src/config/company.ts must match the reference invoice exactly (it was copied from it).
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { COMPANY } from "@/config/company";
import { readReferenceInvoice } from "@/server/invoice/reference";

describe("COMPANY", () => {
  it("matches the seller block, bank block and signature of JKTI_INV_108.xlsx", async () => {
    const ref = await readReferenceInvoice(await readFile("tests/fixtures/invoices/JKTI_INV_108.xlsx"));
    const s = ref.seller;
    expect(COMPANY.name).toBe(s.name);
    expect([...COMPANY.addressLines]).toEqual(s.addressLines);
    expect(COMPANY.phone).toBe(s.phone);
    expect(COMPANY.contactNo).toBe(s.contactNo);
    expect(COMPANY.pan).toBe(s.pan);
    expect(COMPANY.gstin).toBe(s.gstin);
    expect(COMPANY.stateCode).toBe(s.stateCode);
    expect(Number(COMPANY.stateCodeForGst)).toBe(Number(s.stateCode));
    expect(COMPANY.state).toBe(s.state);
    expect(COMPANY.placeOfSupply).toBe(ref.placeOfSupply);
    expect(COMPANY.sacCode).toBe(s.sacCode);
    expect(COMPANY.transporterShortName).toBe(s.transporterShortName);
    expect(COMPANY.invoicePrefix).toBe(s.invoicePrefix);
    expect(COMPANY.bank).toEqual({ beneficiary: s.bankBeneficiary, accountNo: s.bankAccountNo, ifsc: s.bankIfsc, bankName: s.bankName });
    expect(Buffer.compare(await readFile(COMPANY.signatureFile), ref.signature!.buffer)).toBe(0);
  });
});
