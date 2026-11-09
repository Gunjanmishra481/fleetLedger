import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { KpiCard } from "@/components/fl/kpi-card";
import { NumberPlate } from "@/components/fl/number-plate";
import { BarList, EmptyMonth, MonthCalendar, SectionCard } from "@/components/fl/summary-bits";
import { TileGrid } from "@/components/fl/tile-grid";
import { TripCard } from "@/components/trips/trip-card";
import { displayName, formatINR, formatLakh, formatMonthKey, formatNumber } from "@/lib/format";
import { parseMonth } from "@/lib/month";
import { listTrips } from "@/server/queries/trips";
import { dayCounts, latestMonthWithTrips, monthFlags, trailerSummary } from "@/server/services/summary";

export default async function TrailerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const vehicleId = Number(id);
  const m = parseMonth(sp.m);
  const s = await trailerSummary(vehicleId, m);
  if (!s) notFound();
  const [trips, flags, counts, latest] = await Promise.all([
    listTrips({ m, vehicle: vehicleId }),
    monthFlags(m),
    dayCounts(m, { vehicleId }),
    latestMonthWithTrips(),
  ]);
  const t = s.totals;
  const q = `?m=${m}`;
  const dieselPct = s.diesel.standard ? Math.round((s.diesel.actual / s.diesel.standard) * 100) : null;

  return (
    <div className="space-y-5">
      <Link href={`/fleet${q}`} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted">
        <ChevronLeft className="size-4" /> Fleet
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <NumberPlate regNo={s.vehicle.regNo} size="lg" />
          <p className="text-sm text-muted-foreground">
            {s.vehicle.ownerType === "MARKET" ? "Market vehicle" : "Own trailer"}
            {s.vehicle.usualDriver && <> · usually {displayName(s.vehicle.usualDriver)}</>} · {formatMonthKey(m)}
          </p>
        </div>
        <Link href={`/trips/new?vehicle=${vehicleId}&m=${m}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="size-4" /> Trip for this trailer
        </Link>
      </div>

      {t.trips === 0 ? (
        <EmptyMonth month={m} latest={latest} path={`/trailers/${vehicleId}`} />
      ) : (
        <>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(10rem,100%),1fr))]">
            <KpiCard label="Trips" value={formatNumber(t.trips)} href={`/trips${q}&vehicle=${vehicleId}`} />
            <KpiCard label="Active days" value={`${Math.round(s.utilisation * 100)}%`} />
            <KpiCard label="Revenue" value={formatLakh(t.freight)} />
            <KpiCard label="Profit" value={formatINR(t.profit)} tone={t.profit < 0 ? "loss" : "profit"} />
            <KpiCard label="Profit / trip" value={formatINR(Math.round(t.profit / t.trips))} />
            <KpiCard label="Diesel vs standard" value={dieselPct !== null ? `${dieselPct}%` : "—"} />
          </div>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(19rem,100%),1fr))]">
            <SectionCard title={`Trip days · ${s.activeDays} of month`}>
              <MonthCalendar monthKey={m} counts={counts} hrefFor={(day) => `/trips${q}&vehicle=${vehicleId}&day=${day}`} />
            </SectionCard>
            <SectionCard title="Destinations">
              <BarList
                items={s.destinations.map((d) => ({ key: d.name, label: displayName(d.name), value: d.trips, note: formatINR(d.profit) }))}
                format={(n) => `${n}`}
              />
            </SectionCard>
            <SectionCard title="Drivers">
              <ul className="space-y-1">
                {s.drivers.map((d) => (
                  <li key={d.name}>
                    {d.id ? (
                      <Link href={`/drivers/${d.id}${q}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 hover:bg-muted">
                        <span className="font-medium">{displayName(d.name)}</span>
                        <span className="num text-sm text-muted-foreground">{d.trips} trips</span>
                      </Link>
                    ) : (
                      <span className="flex min-h-11 items-center justify-between gap-3 px-2 text-warn">
                        <span>No driver</span>
                        <span className="num text-sm">{d.trips} trips</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Trips</h2>
            <TileGrid min="18rem" gap="0.75rem">
              {[...trips].reverse().map((r) => (
                <TripCard key={r.id} t={{ ...r, flags: flags.get(r.id) ?? [] }} month={m} href={`/trips/${r.id}${q}`} />
              ))}
            </TileGrid>
          </section>
        </>
      )}
    </div>
  );
}
