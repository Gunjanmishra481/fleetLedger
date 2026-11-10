import { cn } from "@/lib/utils";

const LOOK: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  ISSUED: { label: "Issued", cls: "bg-accent text-accent-foreground" },
  PAID: { label: "Paid", cls: "bg-profit-soft text-profit" },
  CANCELLED: { label: "Cancelled", cls: "bg-loss-soft text-loss line-through decoration-1" },
};

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const l = LOOK[status] ?? { label: status, cls: "bg-muted" };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", l.cls, className)}>{l.label}</span>;
}
