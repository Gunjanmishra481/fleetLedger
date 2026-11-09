import Link from "next/link";
import { AlertTriangle, ChevronRight, Plus } from "lucide-react";
import { KpiCard, delta } from "@/components/fl/kpi-card";
import { NumberPlate } from "@/components/fl/number-plate";
import { EmptyMonth, SectionCard } from "@/components/fl/summary-bits";
import { formatINR, formatLakh, formatMonthKey, formatNumber, istToday } from "@/lib/format";
import { parseMonth } from "@/lib/month";
import { cn } from "@/lib/utils";
import { dashboard, fleetToday, latestMonthWithTrips } from "@/server/services/summary";

// Where each flag's one-tap fix goes.
const FIX: Record<string, { href: (m: string) => string; cta: string }> = {
  NO_DRIVER: { href: (m) => `/trips?m=${m}&driver=none`, cta: "Add drivers" },
  ZERO_COST: { href: (m) => `/trips?m=${m}&flagged=1`, cta: "Review" },
  DUP_LR: { href: (m) => `/trips?m=${m}&q=DUP`, cta: "Fix LR" },
  DIESEL_HIGH: { href: (m) => `/trips?m=${m}&flagged=1`, cta: "Review" },
  FREIGHT_MISMATCH: { href: (m) => `/trips?m=${m}&flagged=1`, cta: "Review" },
  BUSY_TRAILER: { href: (m) => `/trips?m=${m}&flagged=1`, cta: "Review" },
};

function greeting() {
  const h = (new Date().getUTCHours() + 5.5) % 24;
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const m = parseMonth((await searchParams).m);
  const today = istToday();
  const [d, fleet, latest] = await Promise.all([dashboard(m), fleetToday(today), latestMonthWithTrips()]);
  const k = d.kpis;
  const p = d.prev;
  const margin = k.freight ? k.profit / k.freight : 0;
  const prevMargin = p.freight ? p.profit / p.freight : 0;
  const onTrip = fleet.filter((v) => v.tripsToday > 0);
  const idle = fleet.filter((v) => v.tripsToday === 0);
  const q = `?m=${m}`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
        </p>
        <h1 className="text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-semibold tracking-tight">{greeting()}</h1>
      </div>

      {/* Today: on trip vs idle */}
      <SectionCard
        title="Fleet today"
        action={
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-profit">{onTrip.length}</span> on trip · {idle.length} idle
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          {[...onTrip, ...idle].map((v) => {
            const busy = v.tripsToday > 0;
            return (
              <Link
                key={v.id}
                href={busy ? `/trailers/${v.id}${q}` : `/trips/new?vehicle=${v.id}&m=${m}`}
                className={cn(
                  "inline-flex min-h-12 items-center gap-2 rounded-xl border bg-card py-1.5 pr-3 pl-1.5 transition-colors hover:border-primary/50",
                  !busy && "border-dashed",
                )}
                title={busy ? `${v.regNo}: ${v.tripsToday} trip(s) today` : `${v.regNo} is idle: tap to log a trip`}
              >
                <NumberPlate regNo={v.regNo} size="sm" />
                {busy ? (
                  <span className="num text-xs font-semibold text-profit">{v.tripsToday} today</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    <Plus className="size-3.5" /> Trip
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </SectionCard>

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{formatMonthKey(m)}</h2>
        <Link href={`/trips${q}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary">
          All trips <ChevronRight className="size-4" />
        </Link>
      </div>

      {k.trips === 0 ? (
        <EmptyMonth month={m} latest={latest} path="/dashboard" />
      ) : (
        <>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(10.5rem,100%),1fr))]">
            <KpiCard label="Trips" value={formatNumber(k.trips)} delta={delta(k.trips, p.trips)} spark={d.days.map((x) => x.trips)} href={`/trips${q}`} />
            <KpiCard label="Cars moved" value={formatNumber(k.cars)} delta={delta(k.cars, p.cars)} spark={d.days.map((x) => x.cars)} href={`/trips${q}`} />
            <KpiCard label="Revenue" value={formatLakh(k.freight)} delta={delta(k.freight, p.freight)} spark={d.days.map((x) => x.freight)} href={`/trips${q}`} />
            <KpiCard
              label="Profit"
              value={formatLakh(k.profit)}
              tone={k.profit < 0 ? "loss" : "profit"}
              delta={delta(k.profit, p.profit)}
              spark={d.days.map((x) => x.profit)}
              href={`/trips${q}`}
            />
            <KpiCard
              label="Margin"
              value={`${Math.round(margin * 100)}%`}
              delta={p.freight ? margin - prevMargin : null}
              spark={d.days.map((x) => (x.freight ? x.profit / x.freight : 0))}
            />
            <KpiCard
              label="Diesel"
              value={`${formatNumber(Math.round(k.dieselL))} L`}
              delta={delta(k.dieselL, p.dieselL)}
              deltaGoodWhenUp={false}
              spark={d.days.map((x) => x.dieselL)}
            />
          </div>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(20rem,100%),1fr))]">
            <SectionCard title="Needs attention">
              {d.flags.length === 0 && k.unbilled === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing to fix this month.</p>
              ) : (
                <ul className="divide-y">
                  {d.flags.map((f) => {
                    const fix = FIX[f.kind];
                    return (
                      <li key={f.kind} className="flex items-center justify-between gap-3 py-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <AlertTriangle className="size-4 shrink-0 text-warn" />
                          <span>
                            <span className="num font-semibold">{f.count}</span> {f.label.toLowerCase()}
                          </span>
                        </span>
                        {fix && (
                          <Link href={fix.href(m)} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-warn-soft px-4 text-sm font-medium text-warn">
                            {fix.cta}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                  {k.unbilled > 0 && (
                    <li className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm">
                        <span className="num font-semibold">{formatINR(k.unbilled)}</span> not invoiced yet
                      </span>
                      <Link href={`/trips${q}&status=UNBILLED`} className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground">
                        See trips
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Best trailers" action={<Link href={`/fleet${q}`} className="text-sm font-medium text-primary">Fleet</Link>}>
              <ul className="space-y-1">
                {d.top.map((t, i) => (
                  <li key={t.vehicleId}>
                    <Link href={`/trailers/${t.vehicleId}${q}`} className="flex min-h-12 items-center gap-3 rounded-lg px-1 hover:bg-muted">
                      <span className="num w-5 text-sm text-muted-foreground">{i + 1}</span>
                      <NumberPlate regNo={t.regNo} size="sm" />
                      <span className="num ml-auto text-right text-sm">
                        <span className="block font-semibold text-profit">{formatINR(t.profit)}</span>
                        <span className="block text-xs text-muted-foreground">{t.trips} trips</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Lowest profit">
              <ul className="space-y-1">
                {d.bottom.map((t) => (
                  <li key={t.vehicleId}>
                    <Link href={`/trailers/${t.vehicleId}${q}`} className="flex min-h-12 items-center gap-3 rounded-lg px-1 hover:bg-muted">
                      <NumberPlate regNo={t.regNo} size="sm" />
                      <span className="num ml-auto text-right text-sm">
                        <span className={cn("block font-semibold", t.profit < 0 ? "text-loss" : "text-foreground")}>{formatINR(t.profit)}</span>
                        <span className="block text-xs text-muted-foreground">{t.trips} trips</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {d.idle.length > 0 && (
                <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">
                  Idle 7+ days at month end:{" "}
                  {d.idle.slice(0, 6).map((v, i) => (
                    <span key={v.vehicleId}>
                      {i > 0 && ", "}
                      <Link href={`/trailers/${v.vehicleId}${q}`} className="font-medium text-foreground hover:underline">
                        {v.regNo}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </SectionCard>
          </div>
          <p className="text-xs text-muted-foreground">Drivers active this month: {k.activeDrivers} · trailers: {k.activeTrailers}.</p>
        </>
      )}
    </div>
  );
}
