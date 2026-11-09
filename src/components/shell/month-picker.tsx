"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMonthKey } from "@/lib/format";
import { parseMonth, shiftMonth } from "@/lib/month";

/** Month scope lives in the URL (?m=YYYY-MM) so every screen and link carries it. */
export function MonthPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const month = parseMonth(params.get("m") ?? undefined);

  function go(key: string) {
    const next = new URLSearchParams(params.toString());
    next.set("m", key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => go(shiftMonth(month, -1))}>
        <ChevronLeft className="size-4" />
      </Button>
      <label className="relative">
        <span className="sr-only">Month</span>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-sm tabular-nums"
          title={formatMonthKey(month)}
        />
      </label>
      <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => go(shiftMonth(month, 1))}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
