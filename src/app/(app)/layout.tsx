import { Suspense } from "react";
import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/shell/month-picker";
import { Sidebar } from "@/components/shell/sidebar";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-52 shrink-0 border-r bg-sidebar md:block">
        <div className="flex h-14 items-center border-b px-5 font-semibold tracking-tight">FleetLedger</div>
        <Suspense>
          <Sidebar />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
          <span className="font-semibold md:hidden">FleetLedger</span>
          <Suspense>
            <MonthPicker />
          </Suspense>
          <form action={logout} className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user}</span>
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="size-4" />
              Sign out
            </Button>
          </form>
        </header>
        <div className="border-b md:hidden">
          <Suspense>
            <div className="overflow-x-auto [&_nav]:flex-row">
              <Sidebar />
            </div>
          </Suspense>
        </div>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
