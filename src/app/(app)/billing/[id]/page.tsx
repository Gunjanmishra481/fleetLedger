import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { InvoiceActions } from "@/components/billing/invoice-actions";
import { InvoicePaper } from "@/components/billing/invoice-paper";
import { StatusChip } from "@/components/billing/status-chip";
import { formatRupees, plural } from "@/lib/format";
import { invoiceDetail } from "@/server/queries/billing";

const ACTION: Record<string, string> = { DRAFT: "Draft saved", UPDATE: "Draft updated", ISSUE: "Issued", PAID: "Marked paid", CANCEL: "Cancelled", DELETE: "Deleted" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await invoiceDetail(Number(id));
  if (!inv) notFound();
  const d = inv.doc;
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/billing" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted">
            <ChevronLeft className="size-4" /> Billing
          </Link>
          <h1 className="num flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {inv.number ?? "Draft invoice"} <StatusChip status={inv.status} />
          </h1>
          <p className="num text-sm text-muted-foreground">
            {inv.consignor.name} · {plural(d.lines.length, "trip")} · {formatRupees(d.totals.total)}
          </p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-6">
        <div className="print-area min-w-0 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-border print:rounded-none print:shadow-none print:ring-0">
          <InvoicePaper
            doc={d}
            watermark={inv.status === "DRAFT" ? "Draft" : inv.status === "CANCELLED" ? "Cancelled" : undefined}
            className="p-[2cqw] print:p-0"
          />
        </div>

        <aside className="no-print mt-4 space-y-4 lg:sticky lg:top-24 lg:mt-0">
          <InvoiceActions id={inv.id} status={inv.status} consignorId={inv.consignorId} />
          {inv.trips.length > 0 && (
            <div className="card-surface p-4">
              <p className="mb-2 text-sm font-semibold">Trips on this invoice</p>
              <div className="flex flex-wrap gap-1.5">
                {inv.trips.map((t) => (
                  <Link key={t.id} href={`/trips/${t.id}`} className="num inline-flex min-h-11 items-center rounded-full border bg-card px-3 text-sm hover:bg-muted">
                    LR {t.lrNo}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="card-surface p-4">
            <p className="mb-2 text-sm font-semibold">History</p>
            <ol className="space-y-1.5 text-sm">
              {inv.audit.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{ACTION[a.action] ?? a.action}</span>
                  <span className="text-muted-foreground"> · {a.user} · {new Date(a.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
