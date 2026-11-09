import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Phone } from "lucide-react";
import { NumberPlate } from "@/components/fl/number-plate";
import { RouteLine } from "@/components/fl/route-line";
import { EmptyMonth, MonthCalendar, SectionCard } from "@/components/fl/summary-bits";
import { plural, displayName, formatRupees, formatMonthKey, formatNumber, initials } from "@/lib/format";
import { parseMonth } from "@/lib/month";
import { dayCounts, driverSummary, latestMonthWithTrips } from "@/server/services/summary";

export default async function DriverPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const driverId = Number(id);
  const m = parseMonth(sp.m);
  const s = await driverSummary(driverId, m);
  if (!s) notFound();
  const [counts, latest] = await Promise.all([dayCounts(m, { driverId }), latestMonthWithTrips()]);
  const t = s.totals;
  const q = `?m=${m}`;
  // No advances/payments ledger yet (phase 4), so everything earned is still due.
  const balanceDue = t.allowance;

  return (
    <div className="space-y-5">
      <Link href={`/fleet?tab=drivers&m=${m}`} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted">
        <ChevronLeft className="size-4" /> Drivers
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">{initials(s.driver.name)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{displayName(s.driver.name)}</h1>
          <p className="text-sm text-muted-foreground">
            {formatMonthKey(m)}
            {s.driver.aliases.length > 0 && <> · also spelled {s.driver.aliases.join(", ")}</>}
          </p>
        </div>
        {s.driver.phone ? (
          <a href={`tel:${s.driver.phone}`} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90">
            <Phone className="size-5" /> Call
          </a>
        ) : (
          <span className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-dashed px-4 text-sm text-muted-foreground" title="Add a phone number in Masters">
            <Phone className="size-4" /> No phone saved
          </span>
        )}
      </div>

      {t.trips === 0 ? (
        <EmptyMonth month={m} latest={latest} path={`/drivers/${driverId}`} />
      ) : (
        <>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(14rem,100%),1fr))]">
            <div className="card-surface p-5">
              <p className="text-sm text-muted-foreground">Allowance earned</p>
              <p className="num text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] font-bold tracking-tight">{formatRupees(t.allowance)}</p>
              <p className="num text-sm text-muted-foreground">
                {t.trips} trips · {formatNumber(t.cars)} cars · {s.activeDays} days
              </p>
            </div>
            <div className="card-surface p-5">
              <p className="text-sm text-muted-foreground">Balance due</p>
              <p className="num text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] font-bold tracking-tight text-primary">{formatRupees(balanceDue)}</p>
              <p className="text-sm text-muted-foreground">Advances and payments are not recorded yet</p>
            </div>
            <div className="card-surface p-5">
              <p className="text-sm text-muted-foreground">Profit from their trips</p>
              <p className={`num text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] font-bold tracking-tight ${t.profit < 0 ? "text-loss" : "text-profit"}`}>{formatRupees(t.profit)}</p>
              <Link href={`/trips${q}&driver=${driverId}`} className="text-sm font-medium text-primary">
                See trips →
              </Link>
            </div>
          </div>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(19rem,100%),1fr))]">
            <SectionCard title="Trip days">
              <MonthCalendar monthKey={m} counts={counts} hrefFor={(day) => `/trips${q}&driver=${driverId}&day=${day}`} />
            </SectionCard>
            <SectionCard title="Trailers driven">
              <ul className="space-y-1">
                {s.trailers.map((v) => (
                  <li key={v.name}>
                    <Link href={`/trailers/${v.id}${q}`} className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-1 hover:bg-muted">
                      <NumberPlate regNo={v.name} size="sm" />
                      <span className="num text-sm text-muted-foreground">{plural(v.trips, "trip")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title="Routes">
              <ul className="space-y-2">
                {s.routes.map((r) => {
                  const [origin, dest] = r.name.split(" → ");
                  return (
                    <li key={r.name} className="flex items-center justify-between gap-3 text-sm">
                      <RouteLine origin={origin} stops={dest.split(" + ")} compact />
                      <span className="num shrink-0 text-muted-foreground">×{r.trips}</span>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
