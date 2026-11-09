"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ClipboardList,
  Database,
  LayoutDashboard,
  Truck,
  Upload,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";

const ICONS: Record<(typeof NAV)[number]["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  trips: ClipboardList,
  drivers: Users,
  trailers: Truck,
  routes: Waypoints,
  import: Upload,
  masters: Database,
};

export function Sidebar() {
  const pathname = usePathname();
  const m = useSearchParams().get("m");
  const qs = m ? `?m=${m}` : "";
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.map(({ href, label, icon }) => {
        const Icon = ICONS[icon];
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={`${href}${qs}`}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
