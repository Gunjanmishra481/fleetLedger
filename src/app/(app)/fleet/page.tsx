import Link from "next/link";
import { RouteCards } from "@/components/fleet/route-cards";
import { NumberPlate } from "@/components/fl/number-plate";
import { TileGrid } from "@/components/fl/tile-grid";
import { displayName, formatINR, formatMonthKey, initials } from "@/lib/format";
import { parseMonth } from "@/lib/month";
import { cn } from "@/lib/utils";
import { driverList, routeSummary, trailerList } from "@/server/services/summary";

const TABS = [
  { key: "trailers", label: "Trailers" },
  { key: "drivers", label: "Drivers" },
  { key: "routes", label: "Routes" },
] as const;

export default async function FleetPage({ searchParams }: { searchParams: Promise<{ m?: string; tab?: string }> }) {
  const sp = await searchParams;
  const m = parseMonth(sp.m);
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "trailers";
  const q = `?m=${m}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
          <p className="text-sm text-muted-foreground">{formatMonthKey(m)}</p>
        </div>
        <nav className="flex rounded-xl bg-muted p-1" aria-label="Fleet sections">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/fleet?tab=${t.key}&m=${m}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn("inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-medium", tab === t.key ? "bg-card shadow-sm" : "text-muted-foreground")}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {tab === "trailers" && <Trailers m={m} q={q} />}
      {tab === "drivers" && <Drivers m={m} q={q} />}
      {tab === "routes" && <RouteCards routes={await routeSummary(m)} month={m} />}
    </div>
  );
}

async function Trailers({ m, q }: { m: string; q: string }) {
  const rows = (await trailerList(m)).sort((a, b) => b.profit - a.profit || a.regNo.localeCompare(b.regNo));
  return (
    <TileGrid min="15rem" gap="0.75rem">
      {rows.map((v) => (
        <Link key={v.id} href={`/trailers/${v.id}${q}`} className="card-surface block space-y-3 p-4 transition-shadow hover:ring-2 hover:ring-primary/25">
          <div className="flex items-center justify-between gap-2">
            <NumberPlate regNo={v.regNo} />
            {v.ownerType === "MARKET" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Market</span>}
          </div>
          <p className="truncate text-sm text-muted-foreground">{v.usualDriver ? displayName(v.usualDriver) : "No usual driver"}</p>
          <div className="num flex items-baseline justify-between text-sm">
            <span>{v.trips} trips</span>
            <span className={cn("font-semibold", v.profit < 0 ? "text-loss" : "text-profit")}>{formatINR(v.profit)}</span>
          </div>
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(v.utilisation * 100)}%` }} />
            </div>
            <p className="num mt-1 text-xs text-muted-foreground">
              {v.activeDays} active days · {Math.round(v.utilisation * 100)}%
            </p>
          </div>
        </Link>
      ))}
    </TileGrid>
  );
}

async function Drivers({ m, q }: { m: string; q: string }) {
  const { rows, unassignedTrips } = await driverList(m);
  const sorted = [...rows].sort((a, b) => b.trips - a.trips || a.name.localeCompare(b.name));
  return (
    <div className="space-y-3">
      {unassignedTrips > 0 && (
        <Link href={`/trips${q}&driver=none`} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-warn-soft px-4 text-sm font-medium text-warn">
          <span>{unassignedTrips} trips have no driver</span>
          <span>Fix →</span>
        </Link>
      )}
      <TileGrid min="14rem" gap="0.75rem">
        {sorted.map((d) => (
          <Link key={d.id} href={`/drivers/${d.id}${q}`} className="card-surface flex items-center gap-3 p-4 transition-shadow hover:ring-2 hover:ring-primary/25">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground">{initials(d.name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{displayName(d.name)}</span>
              <span className="num block text-sm text-muted-foreground">
                {d.trips} trips · {formatINR(d.allowance)} allowance
              </span>
            </span>
          </Link>
        ))}
      </TileGrid>
    </div>
  );
}
