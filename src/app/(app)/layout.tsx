import { Suspense } from "react";
import { BottomBar, Rail } from "@/components/shell/app-nav";
import { MonthChip } from "@/components/shell/month-chip";
import { GlobalShortcuts } from "@/components/shell/global-shortcuts";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Suspense>
        <Rail />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-[clamp(1rem,3vw,2rem)]">
            <span className="text-lg font-semibold tracking-tight lg:invisible">FleetLedger</span>
            <Suspense>
              <MonthChip />
            </Suspense>
          </div>
        </header>
        <main className="app-main mx-auto w-full max-w-[1200px] flex-1 px-[clamp(1rem,3vw,2rem)] pt-[clamp(1rem,2.5vw,1.75rem)]">
          {children}
        </main>
      </div>
      <Suspense>
        <BottomBar />
        <GlobalShortcuts />
      </Suspense>
    </div>
  );
}
