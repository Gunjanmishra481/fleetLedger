import Link from "next/link";
import { ChevronRight, Database, LogOut, ReceiptIndianRupee, Upload, Waypoints } from "lucide-react";
import { logout } from "../../login/actions";

export default async function MorePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const q = m ? `?m=${m}` : "";
  const items = [
    { href: "/billing", label: "Billing", hint: "Invoices, unbilled trips, VIN sheets", icon: ReceiptIndianRupee },
    { href: `/routes${q}`, label: "Routes", hint: "Profit per loading point → destination", icon: Waypoints },
    { href: `/import${q}`, label: "Import", hint: "Load a monthly Excel sheet", icon: Upload },
    { href: `/masters${q}`, label: "Masters", hint: "Trailers, drivers, places, rate card", icon: Database },
  ];
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">More</h1>
      <ul className="card-surface divide-y overflow-hidden">
        {items.map(({ href, label, hint, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-4 px-4 transition-colors hover:bg-muted">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <form action={logout}>
        <button type="submit" className="card-surface flex min-h-14 w-full items-center gap-4 px-4 text-left font-medium transition-colors hover:bg-muted">
          <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
            <LogOut className="size-5" />
          </span>
          Sign out
        </button>
      </form>
    </div>
  );
}
