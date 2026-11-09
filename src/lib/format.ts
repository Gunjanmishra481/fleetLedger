// Display formatting: Indian grouping (en-IN), ₹, lakh, dd-MMM-yy. Input money is integer paise.
import type { Paise } from "./money";

const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹63,19,590 — shows paise only when the amount has them (or when decimals is forced). */
export function formatINR(paise: Paise, opts: { decimals?: boolean } = {}): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const showDecimals = opts.decimals ?? abs % 100 !== 0;
  const body = showDecimals ? inr2.format(abs / 100) : inr0.format(Math.round(abs / 100));
  return `${neg ? "-" : ""}₹${body}`;
}

/** ₹63.20 L — lakh with two decimals. */
export function formatLakh(paise: Paise): string {
  const lakh = paise / 100 / 100_000;
  const neg = lakh < 0;
  return `${neg ? "-" : ""}₹${Math.abs(lakh).toFixed(2)} L`;
}

/** Plain Indian-grouped number, e.g. litres or counts: 29,525 */
export function formatNumber(n: number, maxDecimals = 2): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: maxDecimals }).format(n);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 01-Sep-26. Dates are stored as date-only values at UTC midnight, so read them in UTC. */
export function formatDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yy = String(d.getUTCFullYear() % 100).padStart(2, "0");
  return `${dd}-${MONTHS[d.getUTCMonth()]}-${yy}`;
}

/** "2026-09" -> "Sep 2026" */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
