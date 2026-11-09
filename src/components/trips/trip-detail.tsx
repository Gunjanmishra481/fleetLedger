import Link from "next/link";
import { AlertTriangle, Phone, X } from "lucide-react";
import { CarIcons } from "@/components/fl/car-count";
import { LiveReceipt } from "@/components/fl/live-receipt";
import { NumberPlate } from "@/components/fl/number-plate";
import { RouteLine } from "@/components/fl/route-line";
import { displayName, formatDate, formatINR, formatRelativeDay, istToday } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TripDetailData } from "@/server/queries/trip-detail";
import { BillingControl, TripActions } from "./trip-actions";

const ACTION: Record<string, string> = { CREATE: "Created", UPDATE: "Changed", DELETE: "Deleted", IMPORT: "Imported" };

/** Ticket-style trip view. Used by /trips/[id] and by the side pane on wide screens. */
export function TripDetail({ t, month, closeHref }: { t: TripDetailData; month: string; closeHref?: string }) {
  const d = new Date(t.date);
  return (
    <div className="space-y-4">
      {/* Ticket */}
      <article className="card-surface overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {formatRelativeDay(d, istToday())} · {formatDate(d)} · #{t.serialNo}
            </p>
            <Link href={`/trailers/${t.vehicle.id}?m=${t.monthKey}`} className="inline-block">
              <NumberPlate regNo={t.vehicle.regNo} size="lg" />
            </Link>
          </div>
          <div className="flex items-start gap-1 text-right">
            <div>
              <p className="text-xs text-muted-foreground">LR</p>
              <p className="num text-2xl font-bold">{t.lrNo}</p>
            </div>
            {closeHref && (
              <Link href={closeHref} scroll={false} aria-label="Close" className="tap -mt-1 -mr-2 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                <X className="size-5" />
              </Link>
            )}
          </div>
        </div>
        {/* Perforation */}
        <div className="relative h-0 border-t-2 border-dashed" aria-hidden>
          <span className="absolute -top-3 -left-3 size-6 rounded-full bg-background" />
          <span className="absolute -top-3 -right-3 size-6 rounded-full bg-background" />
        </div>
        <div className="grid gap-5 p-5 @container sm:grid-cols-[minmax(0,1fr)_auto]">
          <RouteLine origin={t.origin} stops={t.stops} className="text-lg" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-1">
            <div>
              <dt className="text-muted-foreground">Driver</dt>
              <dd className="flex items-center gap-2 font-medium">
                {t.driver ? (
                  <>
                    <Link href={`/drivers/${t.driver.id}?m=${t.monthKey}`} className="hover:underline">
                      {displayName(t.driver.name)}
                    </Link>
                    {t.driver.phone && (
                      <a href={`tel:${t.driver.phone}`} className="tap -my-3 flex items-center justify-center rounded-full text-primary hover:bg-accent" aria-label={`Call ${t.driver.name}`}>
                        <Phone className="size-4" />
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-warn">No driver</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cars</dt>
              <dd className="flex items-center gap-2 font-medium">
                {t.carsCount} <CarIcons count={t.carsCount} />
              </dd>
            </div>
            {t.dealer && (
              <div>
                <dt className="text-muted-foreground">Dealer</dt>
                <dd className="font-medium">{displayName(t.dealer)}</dd>
              </div>
            )}
          </dl>
        </div>
        {t.notes && <p className="border-t px-5 py-3 text-sm text-muted-foreground">{t.notes}</p>}
      </article>

      {t.flags.length > 0 && (
        <div className="rounded-2xl bg-warn-soft p-4 text-sm text-warn">
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" /> Check this trip
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            {t.flags.map((f) => (
              <li key={f.kind}>{f.label}</li>
            ))}
          </ul>
        </div>
      )}

      <LiveReceipt
        freight={t.freight}
        dieselL={t.dieselL}
        dieselAmount={t.dieselAmount}
        podCharge={t.podCharge}
        maintenance={t.maintenance}
        driverAllowance={t.driverAllowance}
        totalCost={t.totalCost}
        profit={t.profit}
      />

      <div className="card-surface space-y-3 p-5">
        <h2 className="font-semibold">Billing</h2>
        <BillingControl id={t.id} status={t.billingStatus} />
      </div>

      <TripActions id={t.id} lrNo={t.lrNo} month={month} />

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold">History</h2>
        {t.audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.createdBy === "seed" || t.createdBy === "test" ? "Imported from the loading sheet." : `Added by ${t.createdBy}.`} No changes since.
          </p>
        ) : (
          <ol className="space-y-4 border-l-2 pl-4">
            {t.audit.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute top-1.5 -left-[1.4rem] size-3 rounded-full border-2 border-card bg-primary" aria-hidden />
                <p className="text-sm">
                  <span className="font-medium">{ACTION[a.action] ?? a.action}</span> by {a.user}
                  <span className="text-muted-foreground"> · {new Date(a.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</span>
                </p>
                {a.changes.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {a.changes.map((c) => (
                      <li key={c.field} className="num">
                        {c.label}: <span className="line-through">{c.money && c.fromN !== undefined ? formatINR(c.fromN) : c.from}</span> →{" "}
                        <span className={cn("text-foreground")}>{c.money && c.toN !== undefined ? formatINR(c.toN) : c.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
