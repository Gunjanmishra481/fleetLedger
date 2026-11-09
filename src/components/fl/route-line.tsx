import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Loading point → numbered stops. `compact` is a single wrapping line for cards; the default is
 * a vertical line with dots, used in the trip form preview and trip detail.
 */
export function RouteLine({
  origin,
  stops,
  compact = false,
  className,
}: {
  origin: string | null;
  stops: string[];
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm", className)}>
        <span className="font-medium">{origin ? displayName(origin) : "—"}</span>
        {stops.map((s, i) => (
          <span key={`${s}-${i}`} className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground" aria-hidden>
              →
            </span>
            {stops.length > 1 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {i + 1}
              </span>
            )}
            <span>{displayName(s)}</span>
          </span>
        ))}
      </span>
    );
  }
  const points = [{ name: origin, kind: "origin" as const }, ...stops.map((s) => ({ name: s, kind: "stop" as const }))];
  return (
    <ol className={cn("relative space-y-4", className)} aria-label="Route">
      {points.length > 1 && <span aria-hidden className="absolute top-3 bottom-3 left-[0.6875rem] w-0.5 rounded bg-primary/30" />}
      {points.map((p, i) => (
        <li key={i} className="relative flex items-center gap-3">
          <span
            className={cn(
              "z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
              p.kind === "origin" ? "border-2 border-primary bg-card text-primary" : "bg-primary text-primary-foreground",
            )}
          >
            {p.kind === "origin" ? "" : i}
          </span>
          <span className={cn("min-w-0", !p.name && "text-muted-foreground")}>
            <span className="block text-xs text-muted-foreground">{p.kind === "origin" ? "Loading at" : `Drop ${i}`}</span>
            <span className="block truncate font-semibold">{p.name ? displayName(p.name) : p.kind === "origin" ? "Pick loading point" : "Pick destination"}</span>
          </span>
        </li>
      ))}
      {stops.length === 0 && (
        <li className="relative flex items-center gap-3 text-muted-foreground">
          <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-primary/40 bg-card" />
          <span className="text-sm">Pick a destination</span>
        </li>
      )}
    </ol>
  );
}
