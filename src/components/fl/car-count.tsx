"use client";

import { Car } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tap the Nth car to set the count (1–max). Number keys 1–9 also work when focused. */
export function CarCountPicker({
  value,
  onChange,
  max = 8,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Cars loaded"
      className="flex flex-wrap gap-2"
      onKeyDown={(e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= max) {
          e.preventDefault();
          onChange(n);
        }
      }}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} car${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className={cn(
            "flex size-12 flex-col items-center justify-center rounded-xl border bg-card text-muted-foreground transition-colors duration-150 hover:border-primary/60",
            n <= value && "border-primary bg-accent text-primary",
            n === value && "ring-2 ring-primary",
          )}
        >
          <Car className="size-5" strokeWidth={n <= value ? 2.4 : 1.6} />
          <span className="num text-[11px] font-semibold">{n}</span>
        </button>
      ))}
    </div>
  );
}

/** Read-only row of small car icons for cards. */
export function CarIcons({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-muted-foreground", className)} aria-label={`${count} cars`}>
      {count <= 8 ? (
        Array.from({ length: count }, (_, i) => <Car key={i} className="size-3.5" aria-hidden />)
      ) : (
        <>
          <Car className="size-3.5" aria-hidden /> ×{count}
        </>
      )}
    </span>
  );
}
