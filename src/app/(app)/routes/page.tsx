import { RouteCards } from "@/components/fleet/route-cards";
import { EmptyMonth } from "@/components/fl/summary-bits";
import { formatMonthKey } from "@/lib/format";
import { parseMonth } from "@/lib/month";
import { latestMonthWithTrips, routeSummary } from "@/server/services/summary";

export default async function RoutesPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const m = parseMonth((await searchParams).m);
  const [routes, latest] = await Promise.all([routeSummary(m), latestMonthWithTrips()]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Routes</h1>
        <p className="text-sm text-muted-foreground">
          {formatMonthKey(m)} · most profitable first · diesel shown as average / route standard
        </p>
      </div>
      {routes.length ? <RouteCards routes={routes} month={m} /> : <EmptyMonth month={m} latest={latest} path="/routes" />}
    </div>
  );
}
