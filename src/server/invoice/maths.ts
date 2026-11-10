// Pure invoice maths: GST split, rounding and amount in words. Money is integer paise.
import type { Paise } from "@/lib/money";

export type InvoiceTotals = {
  subtotal: Paise;
  igst: Paise;
  cgst: Paise;
  sgst: Paise;
  roundOff: Paise; // total − (subtotal + taxes); between −50 and +50 paise
  total: Paise; // whole rupees
  intraState: boolean;
};

/** GST state codes compare numerically: "024" = "24". */
export function sameState(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = Number.parseInt(a ?? "", 10);
  const y = Number.parseInt(b ?? "", 10);
  return Number.isFinite(x) && Number.isFinite(y) && x === y;
}

/** Percent of a paise amount, rounded half-up to the nearest paisa. */
function pct(amount: Paise, percent: number): Paise {
  return Math.round((amount * percent) / 100);
}

/**
 * subtotal = Σ trip freight; same state code → CGST 9% + SGST 9%, otherwise IGST 18%
 * (also when the client's state code is missing); total rounded to the nearest rupee.
 */
export function computeInvoice(input: { amounts: readonly Paise[]; sellerStateCode: string | null; buyerStateCode: string | null }): InvoiceTotals {
  let subtotal = 0;
  for (const a of input.amounts) {
    if (!Number.isInteger(a)) throw new Error(`Line amount must be integer paise, got ${a}`);
    subtotal += a;
  }
  const intraState = sameState(input.sellerStateCode, input.buyerStateCode);
  const igst = intraState ? 0 : pct(subtotal, 18);
  const cgst = intraState ? pct(subtotal, 9) : 0;
  const sgst = intraState ? pct(subtotal, 9) : 0;
  const exact = subtotal + igst + cgst + sgst;
  const total = Math.round(exact / 100) * 100;
  return { subtotal, igst, cgst, sgst, roundOff: total - exact, total, intraState };
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** Indian system: 514821 -> "Five Lakh Fourteen Thousand Eight Hundred Twenty One Only". */
export function amountInWords(rupees: number): string {
  if (!Number.isInteger(rupees) || rupees < 0) throw new Error(`Whole rupees expected, got ${rupees}`);
  if (rupees === 0) return "Zero Only";
  const words = (n: number): string => {
    const crore = Math.floor(n / 10_000_000);
    const lakh = Math.floor((n % 10_000_000) / 100_000);
    const thousand = Math.floor((n % 100_000) / 1000);
    const rest = n % 1000;
    return [
      crore ? `${words(crore)} Crore` : "",
      lakh ? `${belowHundred(lakh)} Lakh` : "",
      thousand ? `${belowHundred(thousand)} Thousand` : "",
      rest ? belowThousand(rest) : "",
    ]
      .filter(Boolean)
      .join(" ");
  };
  return `${words(rupees)} Only`;
}
