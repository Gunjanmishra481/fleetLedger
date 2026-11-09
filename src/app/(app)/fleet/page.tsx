import { Placeholder } from "@/components/shell/placeholder";

// Trailers / Drivers / Routes hub; filled in by step 6 of the design build.
export default function FleetPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  return <Placeholder title="Fleet" searchParams={searchParams} comingIn="step 6" />;
}
