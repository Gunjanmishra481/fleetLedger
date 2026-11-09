"use client";

import { useId, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChipOption = { value: number | string; label: string; hint?: string };

/**
 * Chips for touch and mouse; with `filterable`, typing narrows the chips and Enter picks the first match.
 * Single select by default; `multiple` keeps the order the chips were tapped in (used for route stops).
 */
export function ChipPicker<V extends number | string>({
  options,
  value,
  onChange,
  multiple = false,
  max,
  filterable = false,
  placeholder = "Type to filter",
  label,
  className,
}: {
  options: ChipOption[];
  value: V[];
  onChange: (v: V[]) => void;
  multiple?: boolean;
  max?: number;
  filterable?: boolean;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const id = useId();
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s) || o.hint?.toLowerCase().includes(s)) : options;
  }, [q, options]);

  function toggle(v: V) {
    if (!multiple) return onChange(value[0] === v ? [] : [v]);
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (max && value.length >= max) return;
    onChange([...value, v]);
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      {filterable && (
        <label className="relative block">
          <span className="sr-only">{`Filter ${label}`}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && shown[0]) {
                e.preventDefault();
                toggle(shown[0].value as V);
                setQ("");
              }
            }}
            placeholder={placeholder}
            aria-controls={id}
            className="h-11 w-full rounded-xl border bg-card pr-3 pl-10 text-base outline-none focus-visible:border-primary"
          />
        </label>
      )}
      <div id={id} role="group" aria-label={label} className="flex flex-wrap gap-2">
        {shown.map((o) => {
          const idx = value.indexOf(o.value as V);
          const on = idx >= 0;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.value as V)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium transition-colors duration-150",
                "hover:border-primary/60 hover:bg-accent/60",
                on && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {on &&
                (multiple ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary-foreground text-[11px] font-bold text-primary">
                    {idx + 1}
                  </span>
                ) : (
                  <Check className="size-4" />
                ))}
              <span>{o.label}</span>
              {o.hint && <span className={cn("text-xs", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{o.hint}</span>}
            </button>
          );
        })}
        {shown.length === 0 && <p className="py-2 text-sm text-muted-foreground">No match for “{q}”.</p>}
      </div>
    </div>
  );
}
