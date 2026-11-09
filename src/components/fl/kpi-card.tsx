import Link from "next/link";
import { cn } from "@/lib/utils";

/** Tiny inline SVG sparkline (no chart library needed at this size). */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / span) * 28 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-8 w-full text-primary", className)} aria-hidden>
      <polyline points={`0,30 ${pts} 100,30`} fill="currentColor" opacity="0.1" />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** KPI card: label, big value, change vs last month, optional sparkline; links to the trips behind it. */
export function KpiCard({
  label,
  value,
  delta,
  deltaGoodWhenUp = true,
  spark,
  tone,
  href,
}: {
  label: string;
  value: string;
  delta?: number | null; // fractional change vs previous period
  deltaGoodWhenUp?: boolean;
  spark?: number[];
  tone?: "profit" | "loss";
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "num mt-1 text-[clamp(1.375rem,1.1rem+1vw,1.75rem)] leading-tight font-bold tracking-tight",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
        )}
      >
        {value}
      </p>
      {delta !== undefined && delta !== null && Number.isFinite(delta) && (
        <p
          className={cn(
            "num mt-0.5 text-xs font-medium",
            delta === 0 ? "text-muted-foreground" : (delta > 0) === deltaGoodWhenUp ? "text-profit" : "text-loss",
          )}
        >
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(Math.round(delta * 100))}% vs last month
        </p>
      )}
      {spark && <Sparkline values={spark} className="mt-2" />}
    </>
  );
  const cls = "card-surface block p-4 transition-shadow duration-150";
  return href ? (
    <Link href={href} className={cn(cls, "hover:ring-2 hover:ring-primary/30")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function delta(cur: number, prev: number): number | null {
  return prev ? (cur - prev) / Math.abs(prev) : null;
}
