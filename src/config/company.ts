// Mahakal Logistics is the only company that issues invoices, so its details are fixed here,
// copied exactly from tests/fixtures/invoices/JKTI_INV_108.xlsx (a test checks they still match).
// Clients (Bill To) stay editable masters in the database.

export type Company = {
  name: string;
  addressLines: readonly string[];
  phone: string;
  contactNo: string;
  pan: string;
  gstin: string;
  state: string;
  /** As printed ("STATE CODE- 024"). Compare with stateCodeForGst. */
  stateCode: string;
  /** GST state code used to decide CGST+SGST vs IGST against the client's code. */
  stateCodeForGst: string;
  placeOfSupply: string;
  sacCode: string;
  transporterShortName: string;
  invoicePrefix: string;
  bank: { beneficiary: string; accountNo: string; ifsc: string; bankName: string };
  /** Repo-relative path of the signature printed above "Authorized Signatory". */
  signatureFile: string;
};

export const COMPANY: Company = {
  name: "MAHAKAL LOGISTICS",
  addressLines: ["Darshan Residency, Banglow no 2", "Bopal", "Ahmedabad - 380058"],
  phone: "7418900781, 9316395370",
  contactNo: "7845017178",
  pan: "EANPS0660H",
  gstin: "24EANPS0660H1ZI",
  state: "Gujarat",
  stateCode: "024",
  stateCodeForGst: "24",
  placeOfSupply: "Gujarat",
  sacCode: "996511",
  transporterShortName: "MAHAKAL",
  invoicePrefix: "MKLAMD",
  bank: { beneficiary: "MAHAKAL LOGISTICS", accountNo: "8153019021", ifsc: "IDIB000S080", bankName: "INDIAN BANK" },
  signatureFile: "src/assets/signature.jpeg",
};
