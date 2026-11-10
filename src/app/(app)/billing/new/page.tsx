import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceFlow } from "@/components/billing/invoice-flow";
import { TileGrid } from "@/components/fl/tile-grid";
import { formatRupees, plural } from "@/lib/format";
import { billingHome, newInvoiceData } from "@/server/queries/billing";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string; draft?: string }> }) {
  const sp = await searchParams;
  const clientId = Number(sp.client);
  if (!clientId) {
    const { ready } = await billingHome();
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
        <p className="text-sm text-muted-foreground">Who is this invoice for?</p>
        <TileGrid min="15rem" gap="0.75rem">
          {ready.map((c) => (
            <Link key={c.id} href={`/billing/new?client=${c.id}`} className="card-surface block space-y-1 p-4 hover:ring-2 hover:ring-primary/30">
              <span className="block text-lg font-semibold">{c.name}</span>
              <span className="num block text-sm text-muted-foreground">
                {plural(c.trips, "unbilled trip")} · {formatRupees(c.amount)}
              </span>
            </Link>
          ))}
        </TileGrid>
        {ready.length === 0 && (
          <p className="card-surface p-5 text-sm text-muted-foreground">
            No clients yet. Add one in <Link href="/masters?tab=clients" className="font-medium text-primary underline">Masters → Clients</Link>.
          </p>
        )}
      </div>
    );
  }
  const data = await newInvoiceData(clientId, Number(sp.draft) || undefined);
  if (!data) notFound();
  return <InvoiceFlow data={data} />;
}
