"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Flag, Search, X } from "lucide-react";
import { ChipPicker } from "@/components/fl/chip-picker";
import { ResponsiveSheet } from "@/components/fl/responsive-sheet";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MasterOptions } from "@/server/queries/trips";

type Key = "vehicle" | "driver" | "route" | "dealer" | "status";
const STATUS = [
  { value: "UNBILLED", label: "Unbilled" },
  { value: "INVOICED", label: "Invoiced" },
  { value: "PAID", label: "Paid" },
];

/** Filter chips for the trips feed; each opens a picker (bottom sheet on phone, side panel on PC). State lives in the URL. */
export function FilterChips({ options }: { options: MasterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<Key | null>(null);
  const v = (k: string) => params.get(k) ?? "";

  function set(entries: Record<string, string | null>, close = true) {
    const next = new URLSearchParams(params.toString());
    for (const [k, val] of Object.entries(entries)) {
      if (val) next.set(k, val);
      else next.delete(k);
    }
    if (close) setOpen(null);
    router.push(`${pathname}?${next.toString()}`);
  }

  const name = (list: { id: number; name?: string; regNo?: string }[], id: string) => {
    const hit = list.find((x) => String(x.id) === id);
    return hit ? (hit.regNo ?? displayName(hit.name ?? "")) : null;
  };
  const loading = options.locations.filter((l) => l.kind === "LOADING_POINT");
  const dests = options.locations.filter((l) => l.kind === "DESTINATION");
  const routeLabel = [name(loading, v("from")), name(dests, v("to"))].filter(Boolean).join(" → ") || null;

  const chips: { key: Key; label: string; value: string | null; clear: Record<string, null> }[] = [
    { key: "vehicle", label: "Trailer", value: name(options.vehicles, v("vehicle")), clear: { vehicle: null } },
    { key: "driver", label: "Driver", value: v("driver") === "none" ? "No driver" : name(options.drivers, v("driver")), clear: { driver: null } },
    { key: "route", label: "Route", value: routeLabel, clear: { from: null, to: null } },
    ...(options.dealers.length
      ? [{ key: "dealer" as const, label: "Dealer", value: name(options.dealers, v("dealer")), clear: { dealer: null } }]
      : []),
    { key: "status", label: "Billing", value: STATUS.find((s) => s.value === v("status"))?.label ?? null, clear: { status: null } },
  ];
  const chip = "inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted";
  const anyActive = chips.some((c) => c.value) || v("flagged") || v("q");

  return (
    <div className="space-y-3">
      <label className="relative block max-w-sm">
        <span className="sr-only">Search LR number</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          defaultValue={v("q")}
          placeholder="Search LR no."
          inputMode="numeric"
          onKeyDown={(e) => e.key === "Enter" && set({ q: e.currentTarget.value.trim() || null })}
          className="h-11 w-full rounded-xl border bg-card pr-3 pl-10 text-base outline-none focus-visible:border-primary"
          data-search
        />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
        {chips.map((c) =>
          c.value ? (
            <span key={c.key} className={cn(chip, "border-primary bg-accent pr-1 text-accent-foreground")}>
              <button type="button" onClick={() => setOpen(c.key)} className="min-h-11">
                {c.label}: {c.value}
              </button>
              <button type="button" onClick={() => set(c.clear)} aria-label={`Clear ${c.label}`} className="tap flex items-center justify-center rounded-full hover:bg-background/60">
                <X className="size-4" />
              </button>
            </span>
          ) : (
            <button key={c.key} type="button" onClick={() => setOpen(c.key)} className={chip}>
              {c.label} <ChevronDown className="size-4 text-muted-foreground" />
            </button>
          ),
        )}
        <button
          type="button"
          aria-pressed={v("flagged") === "1"}
          onClick={() => set({ flagged: v("flagged") === "1" ? null : "1" })}
          className={cn(chip, v("flagged") === "1" && "border-warn bg-warn-soft text-warn")}
        >
          <Flag className="size-4" /> Flagged
        </button>
        {anyActive && (
          <button
            type="button"
            onClick={() => router.push(`${pathname}?${new URLSearchParams(Object.fromEntries([["m", v("m")], ["view", v("view")]].filter(([, x]) => x))).toString()}`)}
            className="min-h-11 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Clear all
          </button>
        )}
      </div>

      <ResponsiveSheet open={open === "vehicle"} onClose={() => setOpen(null)} title="Trailer" desktop="side">
        <ChipPicker label="Trailer" filterable placeholder="Type trailer no." options={options.vehicles.map((o) => ({ value: o.id, label: o.regNo }))} value={v("vehicle") ? [Number(v("vehicle"))] : []} onChange={(x) => set({ vehicle: x[0] ? String(x[0]) : null })} />
      </ResponsiveSheet>
      <ResponsiveSheet open={open === "driver"} onClose={() => setOpen(null)} title="Driver" desktop="side">
        <ChipPicker
          label="Driver"
          filterable
          placeholder="Type a name"
          options={[{ value: "none", label: "No driver" }, ...options.drivers.map((o) => ({ value: String(o.id), label: displayName(o.name) }))]}
          value={v("driver") ? [v("driver")] : []}
          onChange={(x) => set({ driver: (x[0] as string | undefined) ?? null })}
        />
      </ResponsiveSheet>
      <ResponsiveSheet open={open === "route"} onClose={() => setOpen(null)} title="Route" desktop="side">
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Loading point</p>
            <ChipPicker label="Loading point" options={loading.map((o) => ({ value: o.id, label: displayName(o.name) }))} value={v("from") ? [Number(v("from"))] : []} onChange={(x) => set({ from: x[0] ? String(x[0]) : null }, false)} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Destination (any stop)</p>
            <ChipPicker label="Destination" filterable placeholder="Type a city" options={dests.map((o) => ({ value: o.id, label: displayName(o.name) }))} value={v("to") ? [Number(v("to"))] : []} onChange={(x) => set({ to: x[0] ? String(x[0]) : null }, false)} />
          </div>
          <button type="button" onClick={() => setOpen(null)} className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground">
            Show trips
          </button>
        </div>
      </ResponsiveSheet>
      <ResponsiveSheet open={open === "dealer"} onClose={() => setOpen(null)} title="Dealer" desktop="side">
        <ChipPicker label="Dealer" options={options.dealers.map((o) => ({ value: o.id, label: displayName(o.name) }))} value={v("dealer") ? [Number(v("dealer"))] : []} onChange={(x) => set({ dealer: x[0] ? String(x[0]) : null })} />
      </ResponsiveSheet>
      <ResponsiveSheet open={open === "status"} onClose={() => setOpen(null)} title="Billing" desktop="side">
        <ChipPicker label="Billing" options={STATUS} value={v("status") ? [v("status")] : []} onChange={(x) => set({ status: (x[0] as string | undefined) ?? null })} />
      </ResponsiveSheet>
    </div>
  );
}
