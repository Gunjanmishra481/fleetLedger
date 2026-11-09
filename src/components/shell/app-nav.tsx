"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Ellipsis, House, ListChecks, Plus, Truck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon; match: string[]; primary?: boolean };

export const TABS: Item[] = [
  { href: "/dashboard", label: "Home", icon: House, match: ["/dashboard"] },
  { href: "/trips", label: "Trips", icon: ListChecks, match: ["/trips"] },
  { href: "/trips/new", label: "Trip", icon: Plus, match: ["/trips/new"], primary: true },
  { href: "/fleet", label: "Fleet", icon: Truck, match: ["/fleet", "/trailers", "/drivers", "/routes"] },
  { href: "/more", label: "More", icon: Ellipsis, match: ["/more", "/masters", "/import"] },
];

function useNav() {
  const pathname = usePathname();
  const m = useSearchParams().get("m");
  const isActive = (it: Item) => {
    if (it.href === "/trips") return pathname === "/trips" || (/^\/trips\/\d/.test(pathname));
    return it.match.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  };
  return { href: (h: string) => (m ? `${h}?m=${m}` : h), isActive };
}

/**
 * Phone, and tablet in portrait: bottom tab bar with a raised centre "+ Trip".
 * Visibility is driven by the .nav-bottom / .nav-rail rules in globals.css.
 */
export function BottomBar() {
  const { href, isActive } = useNav();
  return (
    <nav
      aria-label="Main"
      className="nav-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-card/80"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map((it) => {
          const active = isActive(it);
          const Icon = it.icon;
          return (
            <li key={it.href} className="flex justify-center">
              {it.primary ? (
                <Link
                  href={href(it.href)}
                  className="-mt-5 flex flex-col items-center gap-0.5 text-[11px] font-medium text-primary"
                  aria-current={active ? "page" : undefined}
                >
                  <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95">
                    <Icon className="size-7" strokeWidth={2.5} />
                  </span>
                  + Trip
                </Link>
              ) : (
                <Link
                  href={href(it.href)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors",
                    active && "text-primary",
                  )}
                >
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                  {it.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Tablet landscape: icon rail. >=1024px: rail with labels. */
export function Rail() {
  const { href, isActive } = useNav();
  return (
    <nav aria-label="Main" className="nav-rail sticky top-0 h-dvh shrink-0 flex-col border-r bg-sidebar">
      <Link href={href("/dashboard")} className="flex h-16 items-center gap-2.5 px-4 font-semibold tracking-tight">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Truck className="size-5" />
        </span>
        <span className="rail-label">FleetLedger</span>
      </Link>
      <ul className="flex flex-col gap-1 px-3 py-2">
        {TABS.map((it) => {
          const active = isActive(it);
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={href(it.href)}
                aria-current={active ? "page" : undefined}
                title={it.primary ? "New trip (N)" : it.label}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && !it.primary && "bg-sidebar-accent text-sidebar-accent-foreground",
                  it.primary && "my-1 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="rail-label">{it.primary ? "New trip" : it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
