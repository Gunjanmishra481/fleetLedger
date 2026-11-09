"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Number stepper: big − / + buttons for touch, plus a field that opens the numeric keypad.
 * `value` is a string so partially typed numbers ("98.") survive; the parent parses it.
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  decimals = false,
  prefix,
  suffix,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: boolean;
  prefix?: string;
  suffix?: string;
  label: string;
  className?: string;
}) {
  const n = Number(value);
  const bump = (d: number) => {
    const base = Number.isFinite(n) ? n : 0;
    let next = Math.round((base + d) * 100) / 100;
    if (next < min) next = min;
    if (max !== undefined && next > max) next = max;
    onChange(String(next));
  };
  const btn =
    "tap flex shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors hover:bg-accent active:scale-95 disabled:opacity-40";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button type="button" className={btn} onClick={() => bump(-step)} disabled={Number.isFinite(n) && n <= min} aria-label={`Decrease ${label}`}>
        <Minus className="size-5" />
      </button>
      <label className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-xl border bg-card px-3 focus-within:border-primary">
        <span className="sr-only">{label}</span>
        {prefix && <span className="text-muted-foreground">{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(decimals ? /[^\d.]/g : /\D/g, ""))}
          inputMode={decimals ? "decimal" : "numeric"}
          className="num w-full min-w-0 bg-transparent text-center text-base font-semibold outline-none"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </label>
      <button type="button" className={btn} onClick={() => bump(step)} disabled={max !== undefined && n >= max} aria-label={`Increase ${label}`}>
        <Plus className="size-5" />
      </button>
    </div>
  );
}
