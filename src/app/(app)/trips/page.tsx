import { Placeholder } from "@/components/shell/placeholder";

export default function TripsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  return <Placeholder title="Trips" searchParams={searchParams} comingIn="milestone 4" />;
}
