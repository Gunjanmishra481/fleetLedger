// Month scoping via ?m=YYYY-MM. Every screen reads its month through parseMonth().

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function currentMonthKey(now = new Date()): string {
  // Business runs on IST; shift so month rollover happens at IST midnight.
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMonth(m: string | string[] | undefined): string {
  const v = Array.isArray(m) ? m[0] : m;
  return v && MONTH_RE.test(v) ? v : currentMonthKey();
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** [start, end) as UTC-midnight dates, for date-range queries. */
export function monthRange(key: string): { start: Date; end: Date } {
  const [y, m] = key.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}
