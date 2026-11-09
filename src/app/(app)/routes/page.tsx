import { Placeholder } from "@/components/shell/placeholder";

export default function RoutesPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  return <Placeholder title="Routes" searchParams={searchParams} comingIn="milestone 5" />;
}
