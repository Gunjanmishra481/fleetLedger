import Link from "next/link";
import { AlertTriangle, FileText, Plus } from "lucide-react";
import { StatusChip } from "@/components/billing/status-chip";
import { TileGrid } from "@/components/fl/tile-grid";
import { formatRelativeDay, formatRupees, istToday, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { billingHome } from "@/server/queries/billing";

const FILTERS = [
  { key: "", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "ISSUED", label: "Issued" },
  { key: "PAID", label: "Paid" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "" } = await searchParams;
  const data = await billingHome();
  const today = istToday();
  const invoices = data.invoices.filter((i) => !status || i.status === status);
  const outstanding = data.invoices.filter((i) => i.status === "ISSUED").reduce((n, i) => n + i.total, 0);
  const day = (d: Date) => formatRelativeDay(d, today);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="num text-sm text-muted-foreground">
            {formatRupees(data.ready.reduce((n, c) => n + c.amount, 0))} ready to bill · {formatRupees(outstanding)} issued, not yet paid
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ready to bill</h2>
        {data.ready.length === 0 && data.unassigned.length === 0 && (
          <p className="card-surface p-5 text-sm text-muted-foreground">Nothing waiting: every trip is on an invoice.</p>
        )}
        <TileGrid min="17rem" gap="0.75rem">
          {data.ready.map((c) => (
            <div key={c.id} className="card-surface flex flex-col gap-3 p-4">
              <div>
                <p className="text-lg font-semibold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.billingName}</p>
              </div>
              {c.trips ? (
                <>
                  <p className="num">
                    <span className="text-2xl font-bold">{formatRupees(c.amount)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {plural(c.trips, "unbilled trip")}
                      {c.from && c.to && ` · ${day(c.from)} – ${day(c.to)}`}
                    </span>
                  </p>
                  <Link href={`/billing/new?client=${c.id}`} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    <Plus className="size-4" /> New invoice
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{c.hasLoadingPoints ? "No unbilled trips." : "No loading point linked yet. Link one in Masters → Clients."}</p>
              )}
            </div>
          ))}
        </TileGrid>
        {data.unassigned.length > 0 && (
          <div className="rounded-2xl bg-warn-soft p-4 text-sm text-warn">
            <p className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4" /> Unbilled trips with no client
            </p>
            <ul className="mb-3 space-y-0.5">
              {data.unassigned.map((u) => (
                <li key={u.id ?? "none"} className="num">
                  {u.name}: {plural(u.trips, "trip")}, {formatRupees(u.amount)}
                </li>
              ))}
            </ul>
            <Link href="/masters?tab=clients" className="inline-flex min-h-11 items-center rounded-xl bg-card px-4 font-medium text-foreground">
              Link loading points to clients
            </Link>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Invoices</h2>
          <nav className="flex flex-wrap gap-2" aria-label="Filter invoices">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key ? `/billing?status=${f.key}` : "/billing"}
                aria-current={status === f.key ? "page" : undefined}
                className={cn("inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-medium hover:bg-muted", status === f.key && "border-primary bg-primary text-primary-foreground hover:bg-primary/90")}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
        {invoices.length === 0 ? (
          <p className="card-surface p-5 text-sm text-muted-foreground">No invoices here yet.</p>
        ) : (
          <TileGrid min="16rem" gap="0.75rem">
            {invoices.map((i) => (
              <Link key={i.id} href={`/billing/${i.id}`} className="card-surface block space-y-2 p-4 transition-shadow hover:ring-2 hover:ring-primary/25">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <FileText className="size-4 shrink-0 text-primary" />
                    <span className="num truncate">{i.number ?? "Draft"}</span>
                  </span>
                  <StatusChip status={i.status} />
                </div>
                <p className="num text-2xl font-bold">{formatRupees(i.total)}</p>
                <p className="text-sm text-muted-foreground">
                  {i.client} · {plural(i.trips, "trip")} · {day(i.invoiceDate)}
                </p>
              </Link>
            ))}
          </TileGrid>
        )}
      </section>
    </div>
  );
}
