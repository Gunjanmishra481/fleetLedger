import { Placeholder } from "@/components/shell/placeholder";

export default function DashboardPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  return <Placeholder title="Dashboard" searchParams={searchParams} comingIn="milestone 5" />;
}
