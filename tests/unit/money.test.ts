import { describe, expect, it } from "vitest";
import { rupeesToPaise, sumPaise } from "@/lib/money";

describe("rupeesToPaise", () => {
  it("converts numbers without float drift", () => {
    expect(rupeesToPaise(98.36)).toBe(9836);
    expect(rupeesToPaise(15871)).toBe(1587100);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(rupeesToPaise(-300)).toBe(-30000);
  });
  it("parses strings with ₹ and Indian commas", () => {
    expect(rupeesToPaise("₹63,19,590")).toBe(631959000);
    expect(rupeesToPaise("18,393.32")).toBe(1839332);
    expect(rupeesToPaise("1.005")).toBe(101);
    expect(rupeesToPaise(".5")).toBe(50);
  });
  it("rejects junk", () => {
    expect(() => rupeesToPaise("abc")).toThrow();
    expect(() => rupeesToPaise("")).toThrow();
    expect(() => rupeesToPaise(Number.NaN)).toThrow();
  });
});

describe("sumPaise", () => {
  it("sums integers and refuses fractional paise", () => {
    expect(sumPaise([631959000, -325217900])).toBe(306741100);
    expect(() => sumPaise([1.5])).toThrow();
  });
});
