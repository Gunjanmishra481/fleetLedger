import { Placeholder } from "@/components/shell/placeholder";

export default function ImportPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  return <Placeholder title="Import" searchParams={searchParams} comingIn="milestone 3" />;
}
