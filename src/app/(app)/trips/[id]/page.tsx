import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TripDetail } from "@/components/trips/trip-detail";
import { tripDetail } from "@/server/queries/trip-detail";

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const [{ id }, { m }] = await Promise.all([params, searchParams]);
  const t = await tripDetail(Number(id));
  if (!t) notFound();
  const month = m ?? t.monthKey;
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Link href={`/trips?m=${month}`} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted">
        <ChevronLeft className="size-4" /> Trips
      </Link>
      <TripDetail t={t} month={month} />
    </div>
  );
}
