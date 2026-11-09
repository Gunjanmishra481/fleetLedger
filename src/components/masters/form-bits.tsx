"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MasterResult } from "@/server/actions/masters";

export type FormError = { message: string; field?: string } | null;

/** Runs a master action: pending state, field error, refresh on success. */
export function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<FormError>(null);
  function submit<T>(fn: () => Promise<MasterResult<T>>, onOk?: (data: T) => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError({ message: r.error, field: r.field });
      else {
        onOk?.(r.data);
        router.refresh();
      }
    });
  }
  return { pending, error, setError, submit };
}

export const inputCls =
  "h-12 w-full rounded-xl border bg-card px-4 text-base outline-none transition-shadow focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 aria-[invalid=true]:border-loss";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Segmented<V extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid rounded-xl bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("min-h-11 rounded-lg px-2 text-sm font-medium transition-colors", value === o.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-12 w-full items-center justify-between gap-3 text-left">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] duration-150", checked ? "left-[1.375rem]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function ErrorNote({ error }: { error: FormError }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-loss-soft px-4 py-3 text-sm font-medium text-loss">
      {error.message}
    </p>
  );
}

export function SaveButton({ pending, label = "Save", className }: { pending: boolean; label?: string; className?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn("h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60", className)}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

/** Filter box + "Add" button heading a master list. */
export function ListToolbar({ query, onQuery, placeholder, onAdd, addLabel }: { query: string; onQuery: (q: string) => void; placeholder: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <label className="relative min-w-0 flex-1 basis-56">
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} className={cn(inputCls, "h-11 pl-10")} data-search />
      </label>
      <button type="button" onClick={onAdd} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        <Plus className="size-4" /> {addLabel}
      </button>
    </div>
  );
}

/** Alternative spellings: chips with remove, plus an add box. Used by drivers and places. */
export function AliasEditor({
  aliases,
  onAdd,
  onRemove,
  pending,
}: {
  aliases: { id: number; alias: string }[];
  onAdd: (alias: string) => void;
  onRemove: (id: number) => void;
  pending: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Other spellings</p>
      <p className="text-xs text-muted-foreground">Imports and typing match these to this name.</p>
      {aliases.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {aliases.map((a) => (
            <span key={a.id} className="inline-flex min-h-11 items-center gap-1 rounded-full border bg-muted pl-4 text-sm">
              {a.alias}
              <button type="button" disabled={pending} onClick={() => onRemove(a.id)} aria-label={`Remove spelling ${a.alias}`} className="tap flex items-center justify-center rounded-full hover:bg-background">
                <X className="size-4" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              e.preventDefault();
              onAdd(text);
              setText("");
            }
          }}
          placeholder="Add a spelling"
          className={cn(inputCls, "h-11")}
          aria-label="Add a spelling"
        />
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={() => {
            onAdd(text);
            setText("");
          }}
          className="min-h-11 shrink-0 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

/** Two-tap confirm for destructive actions (merge, delete). */
export function ConfirmButton({ label, confirmLabel, onConfirm, pending, disabled }: { label: string; confirmLabel: string; onConfirm: () => void; pending: boolean; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      disabled={pending || disabled}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={cn(
        "min-h-12 w-full rounded-xl border px-4 text-sm font-semibold transition-colors disabled:opacity-50",
        armed ? "border-loss bg-loss text-white" : "border-loss/40 text-loss hover:bg-loss-soft",
      )}
    >
      {pending ? "Working…" : armed ? confirmLabel : label}
    </button>
  );
}
