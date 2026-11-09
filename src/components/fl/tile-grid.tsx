import { cn } from "@/lib/utils";

/** Fluid grid: as many columns as fit at `min` width each (repeat(auto-fill, minmax(min, 1fr))). */
export function TileGrid({
  min = "9rem",
  gap = "0.625rem",
  className,
  children,
  ...rest
}: { min?: string; gap?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn("grid", className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))`, gap, ...rest.style }}
    >
      {children}
    </div>
  );
}

/** A selectable tile (button) for tile grids. */
export function Tile({
  selected,
  className,
  children,
  ...rest
}: { selected?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...rest}
      className={cn(
        "card-surface relative flex min-h-11 flex-col items-start gap-2 p-3 text-left ring-1 ring-transparent transition-[box-shadow,transform,background-color] duration-150",
        "hover:ring-primary/40 active:scale-[0.98] disabled:opacity-50",
        selected && "bg-accent ring-2 ring-primary",
        className,
      )}
    >
      {children}
    </button>
  );
}
