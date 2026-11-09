import { formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Freight − Cost = Profit. Takes values already produced by compute(); does no maths of its own
 * beyond showing them. `compact` is the one-line version docked at the bottom on phones.
 */
export function LiveReceipt({
  freight,
  dieselL,
  dieselAmount,
  podCharge,
  maintenance,
  driverAllowance,
  totalCost,
  profit,
  compact = false,
  className,
}: {
  freight: number;
  dieselL: number;
  dieselAmount: number;
  podCharge: number;
  maintenance: number;
  driverAllowance: number;
  totalCost: number;
  profit: number;
  compact?: boolean;
  className?: string;
}) {
  const tone = profit < 0 ? "text-loss" : "text-profit";
  if (compact) {
    return (
      <div className={cn("flex items-center justify-between gap-3 text-sm", className)} aria-live="polite">
        <span className="num">
          <span className="text-muted-foreground">Freight </span>
          {formatINR(freight)}
        </span>
        <span className="text-muted-foreground" aria-hidden>
          −
        </span>
        <span className="num">
          <span className="text-muted-foreground">Cost </span>
          {formatINR(totalCost)}
        </span>
        <span className="text-muted-foreground" aria-hidden>
          =
        </span>
        <span className={cn("num text-base font-bold", tone)}>{formatINR(profit)}</span>
      </div>
    );
  }
  const row = (label: string, v: number, sub?: string) => (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">
        {label}
        {sub && <span className="ml-1 text-xs">{sub}</span>}
      </span>
      <span className="num">{formatINR(v)}</span>
    </div>
  );
  return (
    <div className={cn("card-surface p-5", className)} aria-live="polite">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Trip receipt</p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="font-medium">Freight</span>
        <span className="num text-xl font-semibold">{formatINR(freight)}</span>
      </div>
      <div className="my-3 border-t border-dashed" />
      {row("Diesel", dieselAmount, `${formatNumber(dieselL)} L`)}
      {row("POD", podCharge)}
      {row("Driver allowance", driverAllowance)}
      {maintenance > 0 && row("Maintenance", maintenance)}
      <div className="flex items-baseline justify-between gap-3 pt-1 text-sm font-medium">
        <span>Total cost</span>
        <span className="num">− {formatINR(totalCost)}</span>
      </div>
      <div className="my-3 border-t" />
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{profit < 0 ? "Loss" : "Profit"}</span>
        <span className={cn("num text-3xl font-bold tracking-tight", tone)}>{formatINR(profit)}</span>
      </div>
      {freight > 0 && (
        <p className="mt-1 text-right text-xs text-muted-foreground num">{Math.round((profit / freight) * 100)}% margin</p>
      )}
    </div>
  );
}
