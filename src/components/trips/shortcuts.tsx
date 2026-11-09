"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Register shortcuts: N = new trip, / = focus LR search. Ignored while typing in a field. */
export function Shortcuts({ newHref }: { newHref: string }) {
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest("input, select, textarea, [contenteditable]")) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        router.push(newHref);
      } else if (e.key === "/") {
        e.preventDefault();
        document.getElementById("trip-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, newHref]);
  return null;
}
