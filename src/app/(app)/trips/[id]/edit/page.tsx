import { notFound } from "next/navigation";
import { TripFlow } from "@/components/trips/trip-flow";
import { parseMonth } from "@/lib/month";
import { tripForEdit, tripFormData } from "@/server/queries/trip-form";

export default async function EditTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const trip = await tripForEdit(Number(id));
  if (!trip) notFound();
  const data = await tripFormData();
  return <TripFlow data={data} mode="edit" prefill={trip} month={parseMonth(sp.m ?? trip.tripDate.slice(0, 7))} />;
}
