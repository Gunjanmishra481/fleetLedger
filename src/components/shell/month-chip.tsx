"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ResponsiveSheet } from "@/components/fl/responsive-sheet";
import { formatMonthKey } from "@/lib/format";
import { currentMonthKey, parseMonth } from "@/lib/month";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Compact month chip; opens a bottom sheet on phone, a popover on PC. Month lives in ?m=. */
export function MonthChip() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const month = parseMonth(params.get("m") ?? undefined);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(month.slice(0, 4)));
  const today = currentMonthKey();

  function go(key: string) {
    const next = new URLSearchParams(params.toString());
    next.set("m", key);
    next.delete("day");
    setOpen(false);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setYear(Number(month.slice(0, 4)));
          setOpen(true);
        }}
        className="tap inline-flex items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium shadow-sm hover:bg-muted"
        aria-haspopup="dialog"
      >
        <CalendarDays className="size-4 text-primary" />
        <span className="num">{formatMonthKey(month)}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
      <ResponsiveSheet open={open} onClose={() => setOpen(false)} title="Show month" desktop="popover">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className="tap inline-flex items-center justify-center rounded-full hover:bg-muted" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
            <ChevronLeft className="size-5" />
          </button>
          <span className="num text-lg font-semibold">{year}</span>
          <button type="button" className="tap inline-flex items-center justify-center rounded-full hover:bg-muted" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((label, i) => {
            const key = `${year}-${String(i + 1).padStart(2, "0")}`;
            return (
              <button
                key={key}
                type="button"
                onClick={() => go(key)}
                className={cn(
                  "tap rounded-xl border text-sm font-medium transition-colors hover:bg-accent",
                  key === month && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                  key === today && key !== month && "border-primary text-primary",
                )}
                aria-current={key === month ? "true" : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => go(today)} className="tap mt-3 w-full rounded-xl bg-muted text-sm font-medium hover:bg-accent">
          This month
        </button>
      </ResponsiveSheet>
    </div>
  );
}
