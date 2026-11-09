import { describe, expect, it } from "vitest";
import { displayName, formatDate, formatINR, formatLakh, formatMonthKey, formatRelativeDay } from "@/lib/format";
import { rupeesToPaise } from "@/lib/money";

describe("formatINR", () => {
  it("uses Indian grouping (SPEC phase 0 checklist)", () => {
    expect(formatINR(rupeesToPaise(6319590))).toBe("₹63,19,590");
    expect(formatINR(rupeesToPaise(3252179))).toBe("₹32,52,179");
    expect(formatINR(rupeesToPaise(300))).toBe("₹300");
  });
  it("shows paise only when present, or when forced", () => {
    expect(formatINR(1839332)).toBe("₹18,393.32");
    expect(formatINR(1587100, { decimals: true })).toBe("₹15,871.00");
  });
  it("formats losses with a leading minus", () => {
    expect(formatINR(-150000)).toBe("-₹1,500");
  });
});

describe("formatLakh", () => {
  it("rounds to two decimals in lakh (SPEC phase 0 checklist)", () => {
    expect(formatLakh(rupeesToPaise(6319590))).toBe("₹63.20 L");
    expect(formatLakh(rupeesToPaise(3067411))).toBe("₹30.67 L");
  });
});

describe("formatDate", () => {
  it("renders dd-MMM-yy", () => {
    expect(formatDate(new Date(Date.UTC(2026, 8, 1)))).toBe("01-Sep-26");
    expect(formatDate(new Date(Date.UTC(2026, 8, 18)))).toBe("18-Sep-26");
  });
  it("renders month keys", () => {
    expect(formatMonthKey("2026-09")).toBe("Sep 2026");
  });
});

describe("formatRelativeDay", () => {
  const today = new Date(Date.UTC(2026, 8, 18));
  it("says Today / Yesterday, then dd MMM", () => {
    expect(formatRelativeDay(new Date(Date.UTC(2026, 8, 18)), today)).toBe("Today");
    expect(formatRelativeDay(new Date(Date.UTC(2026, 8, 17)), today)).toBe("Yesterday");
    expect(formatRelativeDay(new Date(Date.UTC(2026, 8, 1)), today)).toBe("01 Sep");
    expect(formatRelativeDay(new Date(Date.UTC(2025, 11, 31)), today)).toBe("31 Dec 25");
  });
  it("tidies master names for display", () => {
    expect(displayName("OCPL (DETROJ)")).toBe("OCPL (Detroj)");
    expect(displayName("PIPAVAV PORT")).toBe("Pipavav Port");
  });
});
