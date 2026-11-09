"use client";

import { useState } from "react";
import { Fuel, Trash2 } from "lucide-react";
import { ChipPicker } from "@/components/fl/chip-picker";
import { ResponsiveSheet } from "@/components/fl/responsive-sheet";
import { RouteLine } from "@/components/fl/route-line";
import { Stepper } from "@/components/fl/stepper";
import { Tile, TileGrid } from "@/components/fl/tile-grid";
import { displayName, formatINR, formatNumber, formatRelativeDay, formatRupees, istToday } from "@/lib/format";
import { rupeesToPaise } from "@/lib/money";
import { parseDateOnly } from "@/lib/schemas/trip";
import { deleteDieselRate, deleteRateCard, saveDieselRate, saveRateCard } from "@/server/actions/masters";
import type { MastersData } from "@/server/queries/masters";
import { ErrorNote, Field, ListToolbar, SaveButton, inputCls, useSave } from "./form-bits";

type Route = MastersData["rateRoutes"][number];
type Place = MastersData["locations"][number];

const rupees = (paise: number) => (paise % 100 ? (paise / 100).toFixed(2) : String(paise / 100));
const toPaise = (s: string): number | null => {
  try {
    return rupeesToPaise(s.trim() === "" ? "0" : s);
  } catch {
    return null;
  }
};
const today = () => istToday().toISOString().slice(0, 10);
const shortDate = (iso: string) => formatRelativeDay(parseDateOnly(iso), istToday());

// ---------- Rate card ----------

export function RateCardTab({ routes, locations }: { routes: Route[]; locations: Place[] }) {
  const [q, setQ] = useState("");
  const [editKey, setEditKey] = useState<string | "new" | null>(null);
  const s = q.trim().toUpperCase();
  const shown = s ? routes.filter((r) => r.origin.includes(s) || r.stops.some((x) => x.includes(s))) : routes;
  const editing = editKey === "new" ? null : routes.find((r) => r.key === editKey) ?? null;
  return (
    <div className="space-y-4">
      <ListToolbar query={q} onQuery={setQ} placeholder="Find a route or city" onAdd={() => setEditKey("new")} addLabel="Add route" />
      <p className="text-sm text-muted-foreground">New trips pre-fill freight, diesel, allowance and POD from here. A change from a date never alters trips already saved.</p>
      <TileGrid min="17rem" gap="0.75rem">
        {shown.map((r) => {
          const v = r.versions[0];
          return (
            <Tile key={r.key} onClick={() => setEditKey(r.key)} aria-label={`Edit rate ${r.origin} to ${r.stops.join(" and ")}`}>
              <RouteLine origin={r.origin} stops={[r.stops.join(" + ")]} compact />
              <span className="num text-2xl font-bold">{formatRupees(v.freight)}</span>
              <span className="num grid w-full grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>
                  Diesel <b className="block text-sm text-foreground">{formatNumber(v.stdDieselL)} L</b>
                </span>
                <span>
                  Allowance <b className="block text-sm text-foreground">{formatRupees(v.driverAllowance)}</b>
                </span>
                <span>
                  POD <b className="block text-sm text-foreground">{formatRupees(v.podCharge)}</b>
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                From {shortDate(v.effectiveFrom)}
                {r.versions.length > 1 && ` · ${r.versions.length - 1} older rate${r.versions.length > 2 ? "s" : ""}`}
              </span>
            </Tile>
          );
        })}
      </TileGrid>
      {editKey !== null && (editKey === "new" || editing) && (
        <RateSheet key={editKey} route={editing} locations={locations} onClose={() => setEditKey(null)} />
      )}
    </div>
  );
}

function RateSheet({ route, locations, onClose }: { route: Route | null; locations: Place[]; onClose: () => void }) {
  const cur = route?.versions[0];
  const [originId, setOriginId] = useState<number | null>(route?.originId ?? null);
  const [stopIds, setStopIds] = useState<number[]>(route?.stopIds ?? []);
  const [freight, setFreight] = useState(cur ? rupees(cur.freight) : "");
  const [diesel, setDiesel] = useState(cur ? String(cur.stdDieselL) : "");
  const [allowance, setAllowance] = useState(cur ? rupees(cur.driverAllowance) : "");
  const [pod, setPod] = useState(cur ? rupees(cur.podCharge) : "300");
  const [from, setFrom] = useState(today());
  const save = useSave();
  const del = useSave();
  const correcting = route?.versions.some((v) => v.effectiveFrom === from);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amounts = [toPaise(freight), toPaise(allowance), toPaise(pod)];
    const litres = Number(diesel || "0");
    if (amounts.some((a) => a === null) || !Number.isFinite(litres)) {
      save.setError({ message: "Check the amounts: one of them is not a number." });
      return;
    }
    save.submit(
      () =>
        saveRateCard({
          originId: originId ?? 0,
          stopIds,
          freight: amounts[0],
          stdDieselL: litres,
          driverAllowance: amounts[1],
          podCharge: amounts[2],
          effectiveFrom: from,
        }),
      onClose,
    );
  }

  return (
    <ResponsiveSheet open onClose={onClose} title={route ? "Route rate" : "New route rate"} desktop="side">
      <form className="space-y-5" onSubmit={submit}>
        {route ? (
          <div className="rounded-xl bg-muted p-4">
            <RouteLine origin={route.origin} stops={[route.stops.join(" + ")]} />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Loading point</span>
              <ChipPicker
                label="Loading point"
                options={locations.filter((l) => l.kind === "LOADING_POINT").map((l) => ({ value: l.id, label: displayName(l.name) }))}
                value={originId ? [originId] : []}
                onChange={(v) => setOriginId((v[0] as number | undefined) ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Destinations (up to 3)</span>
              <ChipPicker
                label="Destinations"
                multiple
                max={3}
                filterable
                placeholder="Type a city"
                options={locations.filter((l) => l.kind === "DESTINATION").map((l) => ({ value: l.id, label: displayName(l.name) }))}
                value={stopIds}
                onChange={(v) => setStopIds(v as number[])}
              />
            </div>
          </>
        )}
        <Field label="Freight">
          <Stepper label="Freight" value={freight} onChange={setFreight} step={100} decimals prefix="₹" />
        </Field>
        <Field label="Standard diesel">
          <Stepper label="Standard diesel litres" value={diesel} onChange={setDiesel} step={5} decimals suffix="L" />
        </Field>
        <Field label="Driver allowance">
          <Stepper label="Driver allowance" value={allowance} onChange={setAllowance} step={100} prefix="₹" />
        </Field>
        <Field label="POD">
          <Stepper label="POD" value={pod} onChange={setPod} step={50} prefix="₹" />
        </Field>
        <Field label="Applies from" hint={correcting ? "A rate already starts on this date, so saving corrects it." : "Trips on or after this date get the new rate."}>
          <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className={inputCls} />
        </Field>
        <ErrorNote error={save.error} />
        <SaveButton pending={save.pending} label={route && !correcting ? "Save new rate" : "Save"} />

        {route && (
          <div className="space-y-2 border-t pt-5">
            <p className="text-sm font-medium">Rate history</p>
            <ul className="divide-y rounded-xl border">
              {route.versions.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-1 pr-1 pl-4 text-sm">
                  <span className="num min-w-0 flex-1">
                    <span className="font-semibold">{formatINR(v.freight)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {shortDate(v.effectiveFrom)} → {v.effectiveTo ? shortDate(v.effectiveTo) : "now"} · {formatNumber(v.stdDieselL)} L · {formatRupees(v.driverAllowance)}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={del.pending}
                    onClick={() => {
                      if (window.confirm(`Delete the rate from ${shortDate(v.effectiveFrom)}? Trips already saved keep their amounts.`)) {
                        del.submit(() => deleteRateCard(v.id), route.versions.length === 1 ? onClose : undefined);
                      }
                    }}
                    aria-label={`Delete rate from ${v.effectiveFrom}`}
                    className="tap flex items-center justify-center rounded-full text-loss hover:bg-loss-soft"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <ErrorNote error={del.error} />
          </div>
        )}
      </form>
    </ResponsiveSheet>
  );
}

// ---------- Diesel price ----------

export function DieselTab({ rates }: { rates: MastersData["diesel"] }) {
  const current = rates.find((r) => r.effectiveFrom <= today()) ?? rates[rates.length - 1];
  const [rate, setRate] = useState(current ? rupees(current.ratePaise) : "");
  const [from, setFrom] = useState(today());
  const save = useSave();
  const del = useSave();
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(20rem,100%),1fr))]">
      <section className="card-surface space-y-5 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Fuel className="size-6" />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">Diesel price today</p>
            <p className="num text-3xl font-bold">{current ? `${formatINR(current.ratePaise, { decimals: true })}/L` : "Not set"}</p>
          </div>
        </div>
        <form
          className="space-y-4 border-t pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            const p = toPaise(rate);
            if (p === null) return save.setError({ message: "Enter the price per litre, e.g. 98.36" });
            save.submit(() => saveDieselRate({ ratePaise: p, effectiveFrom: from }));
          }}
        >
          <p className="font-medium">Change the price</p>
          <Field label="Price per litre">
            <Stepper label="Diesel price per litre" value={rate} onChange={setRate} step={0.25} decimals prefix="₹" />
          </Field>
          <Field label="From" hint="New trips on or after this date use it. Saved trips keep their own rate.">
            <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className={inputCls} />
          </Field>
          <ErrorNote error={save.error} />
          <SaveButton pending={save.pending} label="Save price" />
        </form>
      </section>
      <section className="card-surface p-5">
        <h2 className="mb-3 font-semibold">Price history</h2>
        <ul className="divide-y">
          {rates.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-1">
              <span className="num flex-1">
                <span className="font-semibold">{formatINR(r.ratePaise, { decimals: true })}</span>
                <span className="block text-xs text-muted-foreground">from {shortDate(r.effectiveFrom)}</span>
              </span>
              {rates.length > 1 && (
                <button
                  type="button"
                  disabled={del.pending}
                  onClick={() => window.confirm(`Delete the price from ${shortDate(r.effectiveFrom)}?`) && del.submit(() => deleteDieselRate(r.id))}
                  aria-label={`Delete price from ${r.effectiveFrom}`}
                  className="tap flex items-center justify-center rounded-full text-loss hover:bg-loss-soft"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <ErrorNote error={del.error} />
      </section>
    </div>
  );
}
