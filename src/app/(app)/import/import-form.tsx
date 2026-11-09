"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR, formatLakh, formatMonthKey, formatNumber } from "@/lib/format";
import { previewImport, runImport, type ImportSummary } from "@/server/actions/import";

const KIND_LABEL: Record<string, string> = {
  ERROR: "Row errors (must fix)",
  LR_EXISTS: "LR already in database",
  DUPLICATE_LR: "Duplicate LR in sheet",
  DUPLICATE_SERIAL: "Duplicate serial no.",
  MISSING_DRIVER: "Missing driver",
  ZERO_COST: "Revenue with zero cost",
  ALIAS: "Names merged",
};

export function ImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function formData() {
    const fd = new FormData();
    const f = fileRef.current?.files?.[0];
    if (f) fd.set("file", f);
    if (replace) fd.set("replace", "on");
    return fd;
  }

  function onPreview() {
    setError(null);
    setDone(null);
    start(async () => {
      const r = await previewImport(formData());
      if (!r.ok) {
        setSummary(null);
        setError(r.error);
        return;
      }
      setSummary(r.data);
      setReplace(r.data.lrClash);
    });
  }

  function onImport() {
    setError(null);
    start(async () => {
      const r = await runImport(formData());
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(
        `Imported ${r.data.tripsCreated} trips` +
          (r.data.deletedTrips ? `, replacing ${r.data.deletedTrips}` : "") +
          `; ${r.data.rateCardsCreated} new rate-card routes.`,
      );
      setMonth(r.data.months[0] ?? null);
      setSummary(null);
    });
  }

  const groups = summary
    ? Object.entries(
        summary.issues.reduce<Record<string, ImportSummary["issues"]>>((acc, i) => {
          (acc[i.kind] ??= []).push(i);
          return acc;
        }, {}),
      ).sort(([a], [b]) => Object.keys(KIND_LABEL).indexOf(a) - Object.keys(KIND_LABEL).indexOf(b))
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose the loading sheet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
            onChange={() => {
              setSummary(null);
              setDone(null);
            }}
          />
          <Button onClick={onPreview} disabled={pending}>
            {pending && !summary ? "Reading…" : "Preview"}
          </Button>
        </CardContent>
      </Card>

      {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {done && (
        <p className="rounded-md border border-emerald-600/30 bg-emerald-600/5 p-3 text-sm text-emerald-700">
          {done}{" "}
          {month && (
            <Link className="underline" href={`/trips?m=${month}`}>
              Open {formatMonthKey(month)} trips
            </Link>
          )}
        </p>
      )}

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>
              2. Check sheet “{summary.sheetName}” · {summary.months.map(formatMonthKey).join(", ")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Trips", formatNumber(summary.totals.trips)],
                ["Cars", formatNumber(summary.totals.cars)],
                ["Diesel", `${formatNumber(summary.totals.dieselL)} L`],
                ["Revenue", formatLakh(summary.totals.freight)],
                ["Cost", formatLakh(summary.totals.totalCost)],
                ["Profit", formatINR(summary.totals.profit)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>

            {(
              [
                ["New trailers", summary.newVehicles],
                ["New drivers", summary.newDrivers],
                ["New locations", summary.newLocations.map((l) => `${l.name}${l.kind === "LOADING_POINT" ? " (loading)" : ""}`)],
                ["New dealers", summary.newDealers],
              ] as const
            ).map(([label, items]) =>
              items.length ? (
                <div key={label}>
                  <p className="font-medium">
                    {label} ({items.length}) — will be created
                  </p>
                  <p className="text-muted-foreground">{items.join(", ")}</p>
                </div>
              ) : null,
            )}

            {groups.map(([kind, list]) => (
              <details key={kind} open={kind === "ERROR" || kind === "LR_EXISTS"} className="rounded-md border">
                <summary
                  className={`cursor-pointer px-3 py-2 font-medium ${kind === "ERROR" ? "text-destructive" : "text-amber-700"}`}
                >
                  {KIND_LABEL[kind] ?? kind} ({list.length})
                </summary>
                <ul className="max-h-60 overflow-auto border-t px-3 py-2 text-muted-foreground">
                  {list.map((i, n) => (
                    <li key={n}>
                      {i.rowNo ? `Row ${i.rowNo}: ` : ""}
                      {i.message}
                    </li>
                  ))}
                </ul>
              </details>
            ))}

            <div className="flex flex-wrap items-center gap-4 border-t pt-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                Replace existing trips for {summary.months.map(formatMonthKey).join(", ")}
              </label>
              <Button onClick={onImport} disabled={pending || summary.hasErrors || (summary.lrClash && !replace)}>
                {pending ? "Importing…" : `Import ${summary.totals.trips} trips`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
