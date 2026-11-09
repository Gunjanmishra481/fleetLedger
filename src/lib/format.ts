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

/** "Today", "Yesterday", else "01 Sep" (adds the year when it differs). `today` is a UTC-midnight date. */
export function formatRelativeDay(d: Date, today: Date = istToday()): string {
  const diff = Math.round((today.getTime() - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const base = `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === today.getUTCFullYear() ? base : `${base} ${String(d.getUTCFullYear() % 100).padStart(2, "0")}`;
}

/** Today's date in India as a UTC-midnight Date (the convention for stored trip dates). */
export function istToday(now = new Date()): Date {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

/** "JAVAHIR SINGH" -> "JS", "DALBIR" -> "DA" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

/** Title case for display of upper-case master names: "OCPL (DETROJ)" -> "Ocpl (Detroj)". Acronyms of 2-4 letters stay. */
export function displayName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])([a-z]*)/g, (_, a: string, b: string) => a.toUpperCase() + b)
    .replace(/\b(Ocpl|Jkti|Apl|Tci|Ahm)\b/g, (w) => w.toUpperCase());
}
