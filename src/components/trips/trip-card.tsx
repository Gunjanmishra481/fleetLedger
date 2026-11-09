"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Ellipsis, Eye, Pencil } from "lucide-react";
import { CarIcons } from "@/components/fl/car-count";
import { NumberPlate } from "@/components/fl/number-plate";
import { RouteLine } from "@/components/fl/route-line";
import { displayName, formatRupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TripTableRow } from "./trips-table";

/** One trip as a card: plate, driver, route line, cars, freight, profit pill, amber dot when flagged. */
export function TripCard({
  t,
  month,
  selected,
  href,
  wideHref,
}: {
  t: TripTableRow;
  month: string;
  selected?: boolean;
  href: string;
  wideHref?: string; // on screens >=1440px, open the trip in the side pane instead
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);
  const stops = t.destination.split(" + ");
  const q = `?m=${month}`;

  return (
    <article className={cn("card-surface @container relative transition-shadow duration-150 hover:ring-2 hover:ring-primary/25", selected && "ring-2 ring-primary")}>
      <Link
        href={href}
        onClick={(e) => {
          if (wideHref && window.matchMedia("(min-width: 1440px)").matches) {
            e.preventDefault();
            router.push(wideHref, { scroll: false });
          }
        }}
        aria-current={selected ? "true" : undefined}
        className="block space-y-3 rounded-[inherit] p-4 pr-14"
        aria-label={`Trip LR ${t.lrNo}, ${t.regNo}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <NumberPlate regNo={t.regNo} size="sm" />
          <span className={cn("min-w-0 truncate text-sm font-medium", !t.driver && "text-warn")}>{t.driver ? displayName(t.driver) : "No driver"}</span>
        </div>
        <RouteLine origin={t.origin} stops={stops} compact />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <CarIcons count={t.carsCount} />
            <span className="num">LR {t.lrNo}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="num text-sm text-muted-foreground">{formatRupees(t.freight)}</span>
            <span className={cn("num rounded-full px-2.5 py-0.5 text-sm font-semibold", t.profit < 0 ? "bg-loss-soft text-loss" : "bg-profit-soft text-profit")}>
              {t.profit < 0 ? "" : "+"}
              {formatRupees(t.profit)}
            </span>
          </span>
        </div>
      </Link>
      {t.flags.length > 0 && (
        <span className="absolute top-4 right-14 size-2.5 rounded-full bg-warn" title={t.flags.map((f) => f.label).join(", ")}>
          <span className="sr-only">Flagged: {t.flags.map((f) => f.label).join(", ")}</span>
        </span>
      )}
      <div ref={menuRef} className="absolute top-1.5 right-1.5">
        <button
          type="button"
          onClick={() => setMenu((x) => !x)}
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label={`Actions for LR ${t.lrNo}`}
          className="tap flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <Ellipsis className="size-5" />
        </button>
        {menu && (
          <div role="menu" className="absolute top-12 right-0 z-30 w-44 overflow-hidden rounded-xl border bg-popover py-1 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            {[
              { href: `/trips/${t.id}${q}`, label: "Open", icon: Eye },
              { href: `/trips/${t.id}/edit${q}`, label: "Edit", icon: Pencil },
              { href: `/trips/new?copy=${t.id}&m=${month}`, label: "Duplicate", icon: Copy },
            ].map(({ href: h, label, icon: Icon }) => (
              <Link key={label} role="menuitem" href={h} className="flex min-h-11 items-center gap-3 px-4 text-sm hover:bg-muted">
                <Icon className="size-4 text-muted-foreground" /> {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
