// Indian financial year: 1 April to 31 March.

/** Calendar year the FY containing `d` starts in (Apr 2026–Mar 2027 -> 2026). */
export function fyStartYear(d: Date): number {
  return d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

/** "2627" for Apr 2026–Mar 2027. */
export function fyCode(d: Date): string {
  const y = fyStartYear(d);
  return `${String(y % 100).padStart(2, "0")}${String((y + 1) % 100).padStart(2, "0")}`;
}

/** "2026-2027", as printed in the invoice's Period cell. */
export function fyPeriod(d: Date): string {
  const y = fyStartYear(d);
  return `${y}-${y + 1}`;
}

/** "2627" -> "FY 2026-27" */
export function fyLabel(code: string): string {
  const y = 2000 + Number(code.slice(0, 2));
  return `FY ${y}-${code.slice(2)}`;
}

/** Codes for the previous, current and next FY around `d`. */
export function fyOptions(d: Date): string[] {
  const y = fyStartYear(d);
  return [y - 1, y, y + 1].map((s) => `${String(s % 100).padStart(2, "0")}${String((s + 1) % 100).padStart(2, "0")}`);
}
