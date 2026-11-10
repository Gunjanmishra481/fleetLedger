import Link from "next/link";
import { DealersTab, DriversTab, TrailersTab } from "@/components/masters/people-tabs";
import { PlacesTab } from "@/components/masters/places-tab";
import { DieselTab, RateCardTab } from "@/components/masters/rates-tabs";
import { ClientsTab } from "@/components/masters/clients-tab";
import { cn } from "@/lib/utils";
import { mastersData } from "@/server/queries/masters";

const TABS = [
  { key: "trailers", label: "Trailers" },
  { key: "drivers", label: "Drivers" },
  { key: "places", label: "Places" },
  { key: "clients", label: "Clients" },
  { key: "dealers", label: "Dealers" },
  { key: "rates", label: "Rate card" },
  { key: "diesel", label: "Diesel price" },
] as const;

export default async function MastersPage({ searchParams }: { searchParams: Promise<{ tab?: string; m?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "trailers";
  const data = await mastersData();
  const m = sp.m ? `&m=${sp.m}` : "";
  const counts: Record<string, number> = {
    trailers: data.vehicles.length,
    drivers: data.drivers.length,
    places: data.locations.length,
    clients: data.consignors.length,
    dealers: data.dealers.length,
    rates: data.rateRoutes.length,
    diesel: data.diesel.length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Masters</h1>
        <p className="text-sm text-muted-foreground">The lists every trip picks from. Tap anything to edit it.</p>
      </div>
      <nav aria-label="Masters sections" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/masters?tab=${t.key}${m}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted",
              tab === t.key && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {t.label}
            <span className={cn("num text-xs", tab === t.key ? "text-primary-foreground/80" : "text-muted-foreground")}>{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      {tab === "trailers" && <TrailersTab vehicles={data.vehicles} drivers={data.drivers} />}
      {tab === "drivers" && <DriversTab drivers={data.drivers} />}
      {tab === "places" && <PlacesTab locations={data.locations} />}
      {tab === "clients" && <ClientsTab clients={data.consignors} locations={data.locations} />}
      {tab === "dealers" && <DealersTab dealers={data.dealers} />}
      {tab === "rates" && <RateCardTab routes={data.rateRoutes} locations={data.locations} />}
      {tab === "diesel" && <DieselTab rates={data.diesel} />}
    </div>
  );
}
