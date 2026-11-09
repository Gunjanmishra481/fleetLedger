import { Suspense } from "react";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { TripFilters } from "@/components/trips/trip-filters";
import { TripsTable } from "@/components/trips/trips-table";
import { formatMonthKey } from "@/lib/format";
import { listTrips, masterOptions, parseTripFilters } from "@/server/queries/trips";
import { monthFlags } from "@/server/services/summary";

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const f = parseTripFilters(sp);
  const [rows, options, flagMap] = await Promise.all([listTrips(f), masterOptions(), monthFlags(f.m)]);
  const flaggedOnly = sp.flagged === "1";
  const data = rows
    .map((r) => ({ ...r, flags: flagMap.get(r.id) ?? [] }))
    .filter((r) => !flaggedOnly || r.flags.length > 0);
  const qs = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && v ? [[k, v]] : [])),
  ).toString();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Trips · {formatMonthKey(f.m)}</h1>
        <div className="flex gap-2">
          <a href={`/trips/export?${qs || `m=${f.m}`}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download className="size-4" /> Export Excel
          </a>
          <Link href={`/trips/new?m=${f.m}`} className={buttonVariants({ size: "sm" })} title="Shortcut: N">
            <Plus className="size-4" /> New trip
          </Link>
        </div>
      </div>
      <Suspense>
        <TripFilters options={options} />
      </Suspense>
      <TripsTable rows={data} month={f.m} />
    </div>
  );
}
