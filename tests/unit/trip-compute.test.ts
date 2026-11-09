import { describe, expect, it } from "vitest";
import { compute, destinationKey } from "@/server/services/trip";
import { rupeesToPaise as p } from "@/lib/money";

const base = { dieselRate: p(98.36), podCharge: p(300), maintenance: 0 };

describe("compute()", () => {
  it("reproduces SEP-26 row 2 (JKTI -> Rajkot)", () => {
    // 150 L x 98.36 = 14,754; + 300 + 1,500 = 16,554; 28,835 - 16,554 = 12,281
    expect(compute({ ...base, dieselL: 150, driverAllowance: p(1500), freight: p(28835) })).toEqual({
      dieselAmount: p(14754),
      totalCost: p(16554),
      profit: p(12281),
    });
  });

  it("keeps paise exactly (SEP-26 row 3: 85 L)", () => {
    // 85 x 98.36 = 8,360.60; cost 9,660.60; profit 10,180.40
    const r = compute({ ...base, dieselL: 85, driverAllowance: p(1000), freight: p(19841) });
    expect(r).toEqual({ dieselAmount: 836060, totalCost: 966060, profit: 1018040 });
  });

  it("rounds fractional litres to the nearest paisa without float drift", () => {
    // 75.255 L x 98.36 = 7,402.0818 -> 740208 paise
    const zero = { podCharge: 0, driverAllowance: 0, freight: 0 };
    expect(compute({ ...base, ...zero, dieselL: 75.255 }).dieselAmount).toBe(740208);
    // 0.1 + 0.2 litres must not become 0.30000000000000004 x rate
    expect(compute({ ...base, ...zero, dieselL: 0.1 + 0.2 }).dieselAmount).toBe(2951);
  });

  it("includes maintenance and reports losses as negative profit", () => {
    const r = compute({
      dieselL: 100,
      dieselRate: p(100),
      podCharge: p(300),
      maintenance: p(2500),
      driverAllowance: p(1000),
      freight: p(10000),
    });
    expect(r.totalCost).toBe(p(13800));
    expect(r.profit).toBe(p(-3800));
  });

  it("treats a zero-cost trip as all profit (sheet row 155)", () => {
    const r = compute({ dieselL: 0, dieselRate: 0, podCharge: 0, maintenance: 0, driverAllowance: 0, freight: p(15871) });
    expect(r.profit).toBe(p(15871));
  });

  it("rejects non-integer paise and bad litres", () => {
    expect(() => compute({ ...base, dieselL: 1, driverAllowance: 10.5, freight: 0 })).toThrow(/integer paise/);
    expect(() => compute({ ...base, dieselL: -1, driverAllowance: 0, freight: 0 })).toThrow();
  });
});

describe("destinationKey()", () => {
  it("is order-independent and de-duplicated", () => {
    expect(destinationKey([12, 3])).toBe("3-12");
    expect(destinationKey([3, 12, 3])).toBe("3-12");
  });
});
