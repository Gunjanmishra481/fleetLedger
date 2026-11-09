import { Placeholder } from "@/components/shell/placeholder";

export default function TrailersPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  return <Placeholder title="Trailers" searchParams={searchParams} comingIn="milestone 5" />;
}
