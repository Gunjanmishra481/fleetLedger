import { Placeholder } from "@/components/shell/placeholder";

export default function MastersPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  return <Placeholder title="Masters" searchParams={searchParams} comingIn="a later milestone" />;
}
