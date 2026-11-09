"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { ResponsiveSheet } from "@/components/fl/responsive-sheet";
import { cn } from "@/lib/utils";
import { deleteTrip, setBillingStatus } from "@/server/actions/trips";

const STATUSES = [
  { value: "UNBILLED", label: "Unbilled" },
  { value: "INVOICED", label: "Invoiced" },
  { value: "PAID", label: "Paid" },
] as const;

/** Billing status as a segmented control; saves on tap and writes an audit row. */
export function BillingControl({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <div role="radiogroup" aria-label="Billing status" className={cn("grid grid-cols-3 rounded-xl bg-muted p-1", pending && "opacity-70")}>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={value === s.value}
            disabled={pending}
            onClick={() => {
              const prev = value;
              setValue(s.value);
              setErr(null);
              start(async () => {
                const r = await setBillingStatus(id, s.value);
                if (!r.ok) {
                  setValue(prev);
                  setErr(r.error);
                } else router.refresh();
              });
            }}
            className={cn(
              "min-h-11 rounded-lg text-sm font-medium transition-colors duration-150",
              value === s.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {err && <p className="text-sm text-loss">{err}</p>}
    </div>
  );
}

export function TripActions({ id, lrNo, month }: { id: number; lrNo: string; month: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors";
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/trips/${id}/edit?m=${month}`} className={cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90")}>
        <Pencil className="size-4" /> Edit
      </Link>
      <Link href={`/trips/new?copy=${id}&m=${month}`} className={cn(btn, "border bg-card hover:bg-muted")}>
        <Copy className="size-4" /> Duplicate
      </Link>
      <button type="button" onClick={() => setConfirm(true)} className={cn(btn, "text-loss hover:bg-loss-soft")}>
        <Trash2 className="size-4" /> Delete
      </button>
      <ResponsiveSheet open={confirm} onClose={() => setConfirm(false)} title={`Delete trip LR ${lrNo}?`}>
        <p className="mb-4 text-sm text-muted-foreground">The trip is removed from the register and every summary. The audit log keeps a copy of it.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" data-autofocus onClick={() => setConfirm(false)} className={cn(btn, "h-12 border bg-card hover:bg-muted")}>
            Keep it
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await deleteTrip(id);
                router.push(`/trips?m=${month}`);
              })
            }
            className={cn(btn, "h-12 bg-loss text-white hover:bg-loss/90")}
          >
            {pending ? "Deleting…" : "Delete trip"}
          </button>
        </div>
      </ResponsiveSheet>
    </div>
  );
}
