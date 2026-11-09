import Link from "next/link";
import { CalendarX } from "lucide-react";
import { formatMonthKey } from "@/lib/format";
import { monthRange } from "@/lib/month";
import { cn } from "@/lib/utils";

/** Month calendar (Mon-first) with trip days filled; darker = more trips. Days link to that day's trips. */
export function MonthCalendar({
  monthKey,
  counts,
  hrefFor,
}: {
  monthKey: string;
  counts: Record<string, number>;
  hrefFor?: (day: string) => string;
}) {
  const { start, end } = monthRange(monthKey);
  const lead = (start.getUTCDay() + 6) % 7;
  const days: string[] = [];
  for (let d = start; d < end; d = new Date(d.getTime() + 86_400_000)) days.push(d.toISOString().slice(0, 10));
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-muted-foreground" aria-hidden>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`x${i}`} />
        ))}
        {days.map((day) => {
          const n = counts[day] ?? 0;
          const cell = (
            <span
              className={cn(
                "num flex aspect-square min-h-11 min-w-11 flex-col items-center justify-center rounded-lg text-xs",
                n === 0 ? "bg-muted/60 text-muted-foreground" : "font-semibold text-primary-foreground",
              )}
              style={n ? { background: `color-mix(in oklch, var(--primary) ${45 + (n / max) * 55}%, transparent)` } : undefined}
            >
              {Number(day.slice(8))}
              {n > 1 && <span className="text-[9px] leading-none opacity-90">×{n}</span>}
            </span>
          );
          const label = `${day}: ${n} trip${n === 1 ? "" : "s"}`;
          return n && hrefFor ? (
            <Link key={day} href={hrefFor(day)} aria-label={label} className="rounded-lg hover:ring-2 hover:ring-primary/40">
              {cell}
            </Link>
          ) : (
            <span key={day} aria-label={label}>
              {cell}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Ranked horizontal bars (e.g. destinations of a trailer). */
export function BarList({
  items,
  format = (n) => String(n),
}: {
  items: { label: React.ReactNode; value: number; href?: string; key: string; note?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2">
      {items.map((it) => {
        const row = (
          <span className="relative flex min-h-10 items-center justify-between gap-3 overflow-hidden rounded-lg px-3 text-sm">
            <span aria-hidden className="absolute inset-y-0 left-0 rounded-lg bg-accent" style={{ width: `${(it.value / max) * 100}%` }} />
            <span className="relative min-w-0 truncate font-medium">{it.label}</span>
            <span className="num relative shrink-0 text-muted-foreground">
              {it.note && <span className="mr-2 text-xs">{it.note}</span>}
              <span className="font-semibold text-foreground">{format(it.value)}</span>
            </span>
          </span>
        );
        return (
          <li key={it.key}>
            {it.href ? (
              <Link href={it.href} className="block rounded-lg hover:ring-2 hover:ring-primary/30">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Shown when the chosen month has no trips: points to the latest month that does. */
export function EmptyMonth({ month, latest, path }: { month: string; latest: string | null; path: string }) {
  return (
    <div className="card-surface flex flex-col items-center gap-3 p-8 text-center">
      <CalendarX className="size-8 text-muted-foreground" />
      <p className="font-medium">No trips in {formatMonthKey(month)} yet.</p>
      {latest && latest !== month && (
        <Link href={`${path}${path.includes("?") ? "&" : "?"}m=${latest}`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Show {formatMonthKey(latest)}
        </Link>
      )}
    </div>
  );
}

export function SectionCard({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("card-surface p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
