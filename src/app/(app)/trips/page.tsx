import { Suspense } from "react";
import Link from "next/link";
import { Download, LayoutGrid, Plus, Table2 } from "lucide-react";
import { TileGrid } from "@/components/fl/tile-grid";
import { FilterChips } from "@/components/trips/filter-chips";
import { TripCard } from "@/components/trips/trip-card";
import { TripsTable, type TripTableRow } from "@/components/trips/trips-table";
import { formatINR, formatMonthKey, formatRelativeDay, istToday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listTrips, masterOptions, parseTripFilters } from "@/server/queries/trips";
import { monthFlags } from "@/server/services/summary";
import { tripDetail } from "@/server/queries/trip-detail";
import { TripDetail } from "@/components/trips/trip-detail";

type SP = Record<string, string | string[] | undefined>;

export default async function TripsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = parseTripFilters(sp);
  const view = sp.view === "table" ? "table" : "cards";
  const selId = Number(sp.sel) || null;
  const selected = selId && view === "cards" ? await tripDetail(selId) : null;
  const [rows, options, flagMap] = await Promise.all([listTrips(f), masterOptions(), monthFlags(f.m)]);
  const data: TripTableRow[] = rows
    .map((r) => ({ ...r, flags: flagMap.get(r.id) ?? [] }))
    .filter((r) => sp.flagged !== "1" || r.flags.length > 0);

  const keep = Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && v && k !== "view" && k !== "sel" ? [[k, v]] : []));
  const qs = (extra: Record<string, string>) => new URLSearchParams([...keep, ...Object.entries(extra)]).toString();
  const exportQs = new URLSearchParams([...keep.filter(([k]) => k !== "flagged"), ["m", f.m]]).toString();

  // Newest day first; trips within a day by serial.
  const days = new Map<string, TripTableRow[]>();
  for (const t of [...data].reverse()) days.set(t.date, [...(days.get(t.date) ?? []), t]);
  const today = istToday();
  const totalProfit = data.reduce((s, t) => s + t.profit, 0);

  const seg = "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trips</h1>
          <p className="num text-sm text-muted-foreground">
            {formatMonthKey(f.m)} · {data.length} trips · <span className={totalProfit < 0 ? "text-loss" : "text-profit"}>{formatINR(totalProfit)}</span> profit
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-xl bg-muted p-1" role="group" aria-label="View">
            <Link href={`/trips?${qs({})}`} aria-current={view === "cards" ? "page" : undefined} className={cn(seg, view === "cards" ? "bg-card shadow-sm" : "text-muted-foreground")}>
              <LayoutGrid className="size-4" /> Cards
            </Link>
            <Link href={`/trips?${qs({ view: "table" })}`} aria-current={view === "table" ? "page" : undefined} className={cn(seg, view === "table" ? "bg-card shadow-sm" : "text-muted-foreground")}>
              <Table2 className="size-4" /> Table
            </Link>
          </div>
          <a href={`/trips/export?${exportQs}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-muted">
            <Download className="size-4" /> Excel
          </a>
          <Link href={`/trips/new?m=${f.m}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90" title="Shortcut: N">
            <Plus className="size-4" /> New trip
          </Link>
        </div>
      </div>

      <Suspense>
        <FilterChips options={options} />
      </Suspense>

      {view === "table" ? (
        <TripsTable rows={data} month={f.m} />
      ) : data.length === 0 ? (
        <div className="card-surface p-8 text-center text-muted-foreground">
          No trips match. Change the month or filters, or{" "}
          <Link href={`/trips/new?m=${f.m}`} className="font-medium text-primary underline">
            add a trip
          </Link>
          .
        </div>
      ) : (
        <div className={cn(selected && "min-[1440px]:grid min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(24rem,30rem)] min-[1440px]:items-start min-[1440px]:gap-6")}>
        <div className="space-y-2">
          {[...days].map(([day, trips]) => {
            const profit = trips.reduce((s, t) => s + t.profit, 0);
            return (
              <section key={day} aria-label={formatRelativeDay(new Date(day), today)}>
                <header className="sticky top-16 z-10 -mx-1 flex items-baseline justify-between gap-3 bg-background/90 px-1 py-2.5 backdrop-blur">
                  <h2 className="font-semibold">{formatRelativeDay(new Date(day), today)}</h2>
                  <span className="num text-sm text-muted-foreground">
                    {trips.length} trip{trips.length > 1 ? "s" : ""} · <span className={profit < 0 ? "text-loss" : "text-profit"}>{formatINR(profit)}</span>
                  </span>
                </header>
                <TileGrid min="18rem" gap="0.75rem">
                  {trips.map((t) => (
                    <TripCard
                      key={t.id}
                      t={t}
                      month={f.m}
                      selected={t.id === selId}
                      href={`/trips/${t.id}?m=${f.m}`}
                      wideHref={`/trips?${qs({ sel: String(t.id) })}`}
                    />
                  ))}
                </TileGrid>
              </section>
            );
          })}
        </div>
          {selected && (
            <aside className="hidden min-[1440px]:sticky min-[1440px]:top-20 min-[1440px]:block min-[1440px]:max-h-[calc(100dvh-6rem)] min-[1440px]:overflow-y-auto min-[1440px]:pb-4" aria-label="Selected trip">
              <TripDetail t={selected} month={f.m} closeHref={`/trips?${qs({})}`} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
