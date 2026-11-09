import Link from "next/link";
import { RouteLine } from "@/components/fl/route-line";
import { TileGrid } from "@/components/fl/tile-grid";
import { formatRupees, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { routeSummary } from "@/server/services/summary";

type Route = Awaited<ReturnType<typeof routeSummary>>[number];

/** One card per route, most profitable first. Tapping opens the trips on that route. */
export function RouteCards({ routes, month }: { routes: Route[]; month: string }) {
  const sorted = [...routes].sort((a, b) => b.profit - a.profit);
  return (
    <TileGrid min="17rem" gap="0.75rem">
      {sorted.map((r) => {
        const [origin, dest] = r.name.split(" → ");
        const over = r.avgDieselL !== null && r.stdDieselL ? r.avgDieselL / r.stdDieselL - 1 : null;
        return (
          <Link
            key={r.key}
            href={`/trips?m=${month}&from=${r.originId}&to=${r.firstStopId}`}
            className="card-surface block space-y-3 p-4 transition-shadow hover:ring-2 hover:ring-primary/25"
          >
            <RouteLine origin={origin} stops={dest.split(" + ")} compact />
            <div className="flex items-baseline justify-between gap-3">
              <span className="num text-sm text-muted-foreground">
                {r.trips} trip{r.trips > 1 ? "s" : ""} · {formatNumber(r.cars)} cars
              </span>
              <span className={cn("num rounded-full px-2.5 py-0.5 text-sm font-semibold", r.profit < 0 ? "bg-loss-soft text-loss" : "bg-profit-soft text-profit")}>
                {formatRupees(r.profit)}
              </span>
            </div>
            <dl className="num grid grid-cols-3 gap-2 border-t pt-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Freight</dt>
                <dd className="font-semibold">{r.rateFreight !== null ? formatRupees(r.rateFreight) : formatRupees(Math.round(r.freight / r.trips))}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Diesel avg</dt>
                <dd className={cn("font-semibold", over !== null && over > 0.1 && "text-warn")}>
                  {r.avgDieselL !== null ? `${formatNumber(Math.round(r.avgDieselL))} L` : "—"}
                  {r.stdDieselL ? <span className="font-normal text-muted-foreground"> / {formatNumber(r.stdDieselL)}</span> : null}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Margin</dt>
                <dd className="font-semibold">{Math.round(r.margin * 100)}%</dd>
              </div>
            </dl>
          </Link>
        );
      })}
    </TileGrid>
  );
}
