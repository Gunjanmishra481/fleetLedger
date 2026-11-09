"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { MasterOptions } from "@/server/queries/trips";

const sel = "h-8 rounded-md border bg-background px-2 text-sm";

/** URL-driven filters for the trip register; every change updates the query string. */
export function TripFilters({ options }: { options: MasterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }
  const v = (k: string) => params.get(k) ?? "";
  const active = ["vehicle", "driver", "from", "to", "status", "dealer", "day", "q", "flagged"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        placeholder="LR no."
        defaultValue={v("q")}
        className={`${sel} w-28`}
        onKeyDown={(e) => e.key === "Enter" && set("q", e.currentTarget.value.trim())}
        aria-label="Search LR number"
        id="trip-search"
      />
      <select className={sel} value={v("vehicle")} onChange={(e) => set("vehicle", e.target.value)} aria-label="Trailer">
        <option value="">All trailers</option>
        {options.vehicles.map((o) => (
          <option key={o.id} value={o.id}>
            {o.regNo}
          </option>
        ))}
      </select>
      <select className={sel} value={v("driver")} onChange={(e) => set("driver", e.target.value)} aria-label="Driver">
        <option value="">All drivers</option>
        <option value="none">— No driver —</option>
        {options.drivers.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <select className={sel} value={v("from")} onChange={(e) => set("from", e.target.value)} aria-label="From">
        <option value="">All loading points</option>
        {options.locations
          .filter((l) => l.kind === "LOADING_POINT")
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
      </select>
      <select className={sel} value={v("to")} onChange={(e) => set("to", e.target.value)} aria-label="Destination">
        <option value="">All destinations</option>
        {options.locations
          .filter((l) => l.kind === "DESTINATION")
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
      </select>
      <select className={sel} value={v("status")} onChange={(e) => set("status", e.target.value)} aria-label="Billing status">
        <option value="">Any billing</option>
        <option value="UNBILLED">Unbilled</option>
        <option value="INVOICED">Invoiced</option>
        <option value="PAID">Paid</option>
      </select>
      {options.dealers.length > 0 && (
        <select className={sel} value={v("dealer")} onChange={(e) => set("dealer", e.target.value)} aria-label="Dealer">
          <option value="">Any dealer</option>
          {options.dealers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
      <input type="date" className={sel} value={v("day")} onChange={(e) => set("day", e.target.value)} aria-label="Day" />
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={v("flagged") === "1"} onChange={(e) => set("flagged", e.target.checked ? "1" : "")} />
        Flagged only
      </label>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`${pathname}${params.get("m") ? `?m=${params.get("m")}` : ""}`)}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
