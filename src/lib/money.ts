// Money is always integer paise. These helpers are the only place rupees <-> paise conversion happens.

export type Paise = number;

/** Exact conversion of a rupee amount (number or "1,234.56" string) to integer paise. */
export function rupeesToPaise(rupees: number | string): Paise {
  if (typeof rupees === "number") {
    if (!Number.isFinite(rupees)) throw new Error(`Invalid rupee amount: ${rupees}`);
    // toFixed(2) avoids binary-float drift (e.g. 98.36 * 100 = 9835.999...).
    return parseDecimalToPaise(rupees.toFixed(2));
  }
  return parseDecimalToPaise(rupees.replace(/[₹,\s]/g, ""));
}

function parseDecimalToPaise(s: string): Paise {
  const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) throw new Error(`Invalid rupee amount: "${s}"`);
  const [, sign, whole, frac = ""] = m;
  // Round half away from zero on the third decimal.
  const two = (frac + "00").slice(0, 2);
  let paise = Number(whole || "0") * 100 + Number(two);
  if (frac.length > 2 && Number(frac[2]) >= 5) paise += 1;
  return sign ? -paise : paise;
}

export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

export function sumPaise(values: readonly Paise[]): Paise {
  let total = 0;
  for (const v of values) {
    if (!Number.isInteger(v)) throw new Error(`Non-integer paise value: ${v}`);
    total += v;
  }
  return total;
}
