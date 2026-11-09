"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** PC extras (never required): N = new trip, / = focus the page's search box. Ignored while typing. */
export function GlobalShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const m = useSearchParams().get("m");
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest("input, select, textarea, [contenteditable], [role=dialog]")) return;
      if ((e.key === "n" || e.key === "N") && pathname !== "/trips/new") {
        e.preventDefault();
        router.push(`/trips/new${m ? `?m=${m}` : ""}`);
      } else if (e.key === "/") {
        const search = document.querySelector<HTMLInputElement>("[data-search]");
        if (search) {
          e.preventDefault();
          search.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname, m]);
  return null;
}
