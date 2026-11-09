"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet on phones and tablets; at >=1024px becomes a centred dialog, a right side panel,
 * or a popover anchored to its nearest `relative` parent (docs/DESIGN.md).
 */
export function ResponsiveSheet({
  open,
  onClose,
  title,
  children,
  desktop = "dialog",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  desktop?: "dialog" | "side" | "popover";
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(
      "[data-autofocus], input, button:not([data-close]), select, textarea, a[href]",
    );
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])")].filter(
          (el) => !el.hasAttribute("disabled"),
        );
        if (!items.length) return;
        const [a, z] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    if (desktop !== "popover" || window.innerWidth < 1024) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose, desktop]);

  if (!open) return null;

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 animate-in fade-in duration-150",
          desktop === "popover" && "lg:bg-transparent",
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-popover text-popover-foreground shadow-2xl pb-safe",
          "animate-in slide-in-from-bottom duration-200",
          desktop === "dialog" &&
            "lg:inset-auto lg:top-1/2 lg:left-1/2 lg:w-[min(32rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:slide-in-from-bottom-0 lg:zoom-in-95",
          desktop === "side" &&
            "lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[min(26rem,100vw)] lg:rounded-none lg:rounded-l-2xl lg:slide-in-from-bottom-0 lg:slide-in-from-right",
          desktop === "popover" &&
            "lg:absolute lg:inset-auto lg:top-full lg:right-0 lg:mt-2 lg:w-80 lg:rounded-2xl lg:slide-in-from-bottom-0 lg:zoom-in-95",
          className,
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-2 px-5 pt-3 pb-2">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            className="tap -mr-2 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </>
  );
}
