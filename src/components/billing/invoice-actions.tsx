"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Download, Pencil, Printer, Trash2, XCircle } from "lucide-react";
import { ConfirmButton } from "@/components/masters/form-bits";
import { cancelInvoiceAction, deleteInvoiceDraft, markInvoicePaid } from "@/server/actions/billing";

export function InvoiceActions({ id, status, consignorId }: { id: number; status: string; consignorId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, then?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong");
      else {
        then?.();
        router.refresh();
      }
    });
  const btn = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="card-surface space-y-2 p-4">
      {status !== "DRAFT" && (
        <a href={`/billing/${id}/xlsx`} className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}>
          <Download className="size-4" /> Download Excel
        </a>
      )}
      <button type="button" onClick={() => window.print()} className={`${btn} border bg-card hover:bg-muted`}>
        <Printer className="size-4" /> Print / Save as PDF
      </button>
      {status === "ISSUED" && (
        <button type="button" disabled={pending} onClick={() => run(() => markInvoicePaid(id))} className={`${btn} bg-profit-soft text-profit hover:bg-profit-soft/80`}>
          <BadgeCheck className="size-4" /> Mark as paid
        </button>
      )}
      {status === "DRAFT" && (
        <>
          <Link href={`/billing/new?client=${consignorId}&draft=${id}`} className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}>
            <Pencil className="size-4" /> Continue and issue
          </Link>
          <ConfirmButton pending={pending} label="Delete draft" confirmLabel="Tap again to delete the draft" onConfirm={() => run(() => deleteInvoiceDraft(id), () => router.push("/billing"))} />
        </>
      )}
      {(status === "ISSUED" || status === "PAID") && (
        <ConfirmButton
          pending={pending}
          label="Cancel invoice"
          confirmLabel="Tap again: cancel and unlock its trips"
          onConfirm={() => run(() => cancelInvoiceAction(id))}
        />
      )}
      {status === "CANCELLED" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <XCircle className="size-4" /> Cancelled. Its trips can go on a new invoice; this number stays used.
        </p>
      )}
      {error && <p className="rounded-xl bg-loss-soft px-3 py-2 text-sm text-loss">{error}</p>}
      {status === "DRAFT" && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Trash2 className="size-3.5" /> Drafts hold their trips so they aren't billed twice.</p>}
    </div>
  );
}
