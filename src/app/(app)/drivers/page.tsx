import { Placeholder } from "@/components/shell/placeholder";

export default function DriversPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  return <Placeholder title="Drivers" searchParams={searchParams} comingIn="milestone 5" />;
}
