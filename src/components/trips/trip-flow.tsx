"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Pencil, Route as RouteIcon, Search, Truck, UserRound } from "lucide-react";
import { CarCountPicker } from "@/components/fl/car-count";
import { ChipPicker } from "@/components/fl/chip-picker";
import { LiveReceipt } from "@/components/fl/live-receipt";
import { NumberPlate } from "@/components/fl/number-plate";
import { ResponsiveSheet } from "@/components/fl/responsive-sheet";
import { RouteLine } from "@/components/fl/route-line";
import { Stepper } from "@/components/fl/stepper";
import { Tile, TileGrid } from "@/components/fl/tile-grid";
import { displayName, formatINR, formatNumber, formatRelativeDay, initials } from "@/lib/format";
import { rupeesToPaise } from "@/lib/money";
import { parseDateOnly, tripInputSchema, type TripInput } from "@/lib/schemas/trip";
import { cn } from "@/lib/utils";
import { getAutofill, saveTrip, suggestLrNo } from "@/server/actions/trips";
import type { TripFormData, TripPrefill } from "@/server/queries/trip-form";
import { compute } from "@/server/services/trip";

const STEPS = ["Trailer", "Route", "Load", "Check"] as const;
const FIELD_STEP: Record<string, number> = {
  vehicleId: 0, driverId: 0, tripDate: 1, originId: 1, stopIds: 1, carsCount: 2, lrNo: 2, dealerId: 2,
};

const rupees = (paise: number | null | undefined) =>
  paise === null || paise === undefined ? "" : paise % 100 ? (paise / 100).toFixed(2) : String(paise / 100);
const paiseOrNull = (s: string): number | null => {
  try {
    return rupeesToPaise(s.trim() === "" ? "0" : s);
  } catch {
    return null;
  }
};
const shiftDay = (iso: string, d: number) => new Date(parseDateOnly(iso).getTime() + d * 86_400_000).toISOString().slice(0, 10);

type Mode = "create" | "edit";

export function TripFlow({
  data,
  mode = "create",
  prefill,
  month,
}: {
  data: TripFormData;
  mode?: Mode;
  prefill?: Partial<TripPrefill>;
  month: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(prefill?.tripDate ?? data.today);
  const [vehicleId, setVehicleId] = useState<number | null>(prefill?.vehicleId ?? null);
  const [driverId, setDriverId] = useState<number | null>(prefill?.driverId ?? null);
  const [originId, setOriginId] = useState<number | null>(prefill?.originId ?? null);
  const [stopIds, setStopIds] = useState<number[]>(prefill?.stopIds ?? []);
  const [cars, setCars] = useState(prefill?.carsCount ?? 6);
  const [lrNo, setLrNo] = useState(prefill?.lrNo ?? data.suggestedLr);
  const [editLr, setEditLr] = useState(false);
  const [dealerId, setDealerId] = useState<number | null>(prefill?.dealerId ?? null);
  const [dieselL, setDieselL] = useState(prefill?.dieselL !== undefined ? String(prefill.dieselL) : "");
  const [dieselRate, setDieselRate] = useState(rupees(prefill?.dieselRate ?? data.dieselRate));
  const [pod, setPod] = useState(rupees(prefill?.podCharge ?? 30000));
  const [allowance, setAllowance] = useState(rupees(prefill?.driverAllowance ?? null));
  const [maint, setMaint] = useState(rupees(prefill?.maintenance ?? 0));
  const [freight, setFreight] = useState(rupees(prefill?.freight ?? null));
  const [billing, setBilling] = useState<TripInput["billingStatus"]>(prefill?.billingStatus ?? "UNBILLED");
  const [notes, setNotes] = useState(prefill?.notes ?? "");
  const [hint, setHint] = useState<{ stdDieselL: number | null; freight: number | null; found: boolean } | null>(null);
  const [plateQuery, setPlateQuery] = useState("");
  const [driverSheet, setDriverSheet] = useState(false);
  const [pickDate, setPickDate] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const routeSeq = useRef(0);

  const vehicle = data.vehicles.find((v) => v.id === vehicleId) ?? null;
  const driver = data.drivers.find((d) => d.id === driverId) ?? null;
  const locName = useCallback(
    (id: number | null) => [...data.loadingPoints, ...data.destinations].find((l) => l.id === id)?.name ?? null,
    [data.loadingPoints, data.destinations],
  );

  const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

  // ---- autofill ----
  const fillDriver = useCallback(
    async (vid: number) => {
      const v = data.vehicles.find((x) => x.id === vid);
      if (v?.usualDriverId) setDriverId(v.usualDriverId); // instant guess, refined by the server
      const a = await getAutofill({ date, vehicleId: vid });
      if (a.driverId) setDriverId(a.driverId);
    },
    [data.vehicles, date],
  );

  const fillRoute = useCallback(
    async (oid: number | null, stops: number[], overwrite: boolean) => {
      const seq = ++routeSeq.current;
      if (!oid || stops.length === 0) {
        setHint(null);
        return;
      }
      const a = await getAutofill({ date, originId: oid, stopIds: stops });
      if (seq !== routeSeq.current) return;
      setHint({ stdDieselL: a.dieselL, freight: a.freight, found: a.rateCardId !== null });
      if (overwrite && a.rateCardId !== null) {
        setFreight(rupees(a.freight));
        setDieselL(a.dieselL !== null ? String(a.dieselL) : "");
        setAllowance(rupees(a.driverAllowance));
        setPod(rupees(a.podCharge));
      }
    },
    [date],
  );

  // On open: refine driver for a pre-picked trailer; load rate-card hints for a pre-filled route.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (mode === "create" && vehicleId && !prefill?.driverId) void fillDriver(vehicleId);
    if (originId && stopIds.length) void fillRoute(originId, stopIds, mode === "create" && prefill?.freight === undefined);
    if (mode === "create" && vehicleId && originId && stopIds.length) setStep(2);
    else if (mode === "create" && vehicleId) setStep(1);
  }, [mode, vehicleId, originId, stopIds, prefill, fillDriver, fillRoute]);

  // New date -> diesel rate effective on that date (new trips only).
  useEffect(() => {
    if (mode !== "create") return;
    let live = true;
    void getAutofill({ date }).then((a) => live && a.dieselRate !== null && setDieselRate(rupees(a.dieselRate)));
    return () => {
      live = false;
    };
  }, [date, mode]);

  // ---- live money (compute() is the only maths) ----
  const money = useMemo(() => {
    const parts = {
      dieselL: Number(dieselL || "0"),
      dieselRate: paiseOrNull(dieselRate),
      podCharge: paiseOrNull(pod),
      maintenance: paiseOrNull(maint),
      driverAllowance: paiseOrNull(allowance),
      freight: paiseOrNull(freight),
    };
    if (!Number.isFinite(parts.dieselL) || Object.values(parts).some((v) => v === null)) return null;
    const input = parts as { [K in keyof typeof parts]: number };
    return { input, ...compute(input) };
  }, [dieselL, dieselRate, pod, maint, allowance, freight]);

  const receipt = money && freight.trim() !== "" && { ...money.input, dieselAmount: money.dieselAmount, totalCost: money.totalCost, profit: money.profit };
  const dieselRatio = hint?.stdDieselL && money ? money.input.dieselL / hint.stdDieselL : null;

  // ---- step validity ----
  const stepDone = [vehicleId !== null && driverId !== null, originId !== null && stopIds.length > 0, cars > 0 && lrNo.trim() !== "", money !== null];

  function pickVehicle(id: number) {
    setVehicleId(id);
    setError(null);
    void fillDriver(id);
    if (step === 0 && isPhone()) setStep(1);
  }

  function pickRoute(oid: number | null, stops: number[], advance = false) {
    setOriginId(oid);
    setStopIds(stops);
    setError(null);
    void fillRoute(oid, stops, true);
    if (advance && step === 1 && isPhone()) setStep(2);
  }

  // ---- save ----
  async function save() {
    if (!money) {
      setError({ message: "Check the cost amounts: one of them is not a valid number." });
      setStep(3);
      return;
    }
    const input = {
      ...(mode === "edit" && prefill?.id ? { id: prefill.id } : {}),
      tripDate: date,
      lrNo,
      vehicleId: vehicleId ?? 0,
      driverId: driverId ?? 0,
      originId: originId ?? 0,
      stopIds,
      carsCount: cars,
      ...money.input,
      dealerId,
      billingStatus: billing,
      notes: notes.trim() || null,
    };
    const parsed = tripInputSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = String(issue.path[0] ?? "");
      const friendly: Record<string, string> = {
        vehicleId: "Pick a trailer",
        driverId: "Pick the driver",
        originId: "Pick the loading point",
        stopIds: "Pick at least one destination",
      };
      setError({ message: friendly[field] ?? issue.message, field });
      setStep(FIELD_STEP[field] ?? 3);
      return;
    }
    setSaving(true);
    setError(null);
    const r = await saveTrip(parsed.data);
    setSaving(false);
    if (!r.ok) {
      setError({ message: r.error, field: r.field });
      if (r.field) setStep(FIELD_STEP[r.field] ?? 3);
      if (r.field === "lrNo") setEditLr(true);
      return;
    }
    if (mode === "edit") {
      router.push(`/trips/${r.data.id}?m=${month}`);
      router.refresh();
      return;
    }
    setSaved(r.data.id);
  }

  async function again(kind: "trailer" | "route") {
    const next = await suggestLrNo();
    setLrNo(next);
    setEditLr(false);
    setSaved(null);
    setNotes("");
    setDealerId(null);
    if (kind === "trailer") {
      setOriginId(null);
      setStopIds([]);
      setHint(null);
      setFreight("");
      setDieselL("");
      setAllowance("");
      setStep(1);
    } else {
      setVehicleId(null);
      setDriverId(null);
      setStep(0);
    }
    router.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const tripsOn = (v: (typeof data.vehicles)[number]) =>
    date === data.today ? v.tripsToday : date === shiftDay(data.today, -1) ? v.tripsYesterday : 0;
  const plates = data.vehicles.filter((v) => v.regNo.includes(plateQuery.trim().toUpperCase().replace(/\s+/g, "")));

  const section = (i: number) =>
    cn("scroll-mt-24 space-y-4", step !== i && "max-sm:hidden", i > 0 && "sm:border-t sm:pt-6");

  const SectionTitle = ({ i, summary }: { i: number; summary?: React.ReactNode }) => (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          stepDone[i] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {stepDone[i] ? <Check className="size-4" /> : i + 1}
      </span>
      <h2 className="text-lg font-semibold">{STEPS[i]}</h2>
      {summary && <span className="ml-auto hidden min-w-0 truncate text-sm text-muted-foreground sm:block">{summary}</span>}
    </div>
  );

  const saveLabel = mode === "edit" ? "Save changes" : "Looks right — Save";
  const primaryBtn =
    "flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-sm transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50";

  return (
    <div
      className="pb-44 lg:pb-8"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void save();
        }
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{mode === "edit" ? `Edit trip · LR ${prefill?.lrNo}` : "New trip"}</h1>
        <span className="hidden text-xs text-muted-foreground lg:block">Ctrl+Enter saves</span>
      </div>

      {/* Phone progress */}
      <div className="mb-5 sm:hidden">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">
            Step {step + 1} of 4 · {STEPS[step]}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => setStep(i)} aria-label={`Go to ${s}`} className="flex min-h-11 items-center">
              <span className={cn("h-2 w-full rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-loss-soft px-4 py-3 text-sm font-medium text-loss">
          {error.message}
        </p>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start lg:gap-8">
        <div className="space-y-6">
          {/* a) Trailer */}
          <section className={section(0)} aria-label="Trailer">
            <SectionTitle i={0} summary={vehicle && `${vehicle.regNo} · ${driver ? displayName(driver.name) : "no driver"}`} />
            {vehicle && (
              <div className="flex flex-wrap items-center gap-2">
                <NumberPlate regNo={vehicle.regNo} />
                <button
                  type="button"
                  onClick={() => setDriverSheet(true)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors hover:bg-muted",
                    !driver && "border-warn bg-warn-soft text-warn",
                  )}
                >
                  {driver ? (
                    <>
                      <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                        {initials(driver.name)}
                      </span>
                      {displayName(driver.name)}
                    </>
                  ) : (
                    <>
                      <UserRound className="size-4" /> Pick driver
                    </>
                  )}
                  <Pencil className="size-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
            <label className="relative block">
              <span className="sr-only">Find trailer</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={plateQuery}
                onChange={(e) => setPlateQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && plates[0]) {
                    e.preventDefault();
                    pickVehicle(plates[0].id);
                    setPlateQuery("");
                  }
                }}
                placeholder="Type trailer no. e.g. 1658"
                className="h-11 w-full rounded-xl border bg-card pr-3 pl-10 text-base outline-none focus-visible:border-primary"
                data-search
              />
            </label>
            <TileGrid min="9.5rem">
              {plates.map((v) => {
                const n = tripsOn(v);
                return (
                  <Tile key={v.id} selected={v.id === vehicleId} onClick={() => pickVehicle(v.id)} aria-label={`Trailer ${v.regNo}`}>
                    <NumberPlate regNo={v.regNo} size="sm" />
                    <span className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {v.usualDriver && (
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                            {initials(v.usualDriver)}
                          </span>
                        )}
                        <span className="truncate">{v.usualDriver ? displayName(v.usualDriver) : "No usual driver"}</span>
                      </span>
                      {n > 0 && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
                          {n} trip{n > 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                  </Tile>
                );
              })}
            </TileGrid>
            {plates.length === 0 && <p className="text-sm text-muted-foreground">No trailer matches “{plateQuery}”.</p>}
          </section>

          {/* b) Route */}
          <section className={section(1)} aria-label="Route">
            <SectionTitle
              i={1}
              summary={originId && stopIds.length ? `${displayName(locName(originId) ?? "")} → ${stopIds.map((s) => displayName(locName(s) ?? "")).join(" + ")}` : undefined}
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Trip date">
              {[
                { label: "Today", value: data.today },
                { label: "Yesterday", value: shiftDay(data.today, -1) },
              ].map((d) => (
                <button
                  key={d.label}
                  type="button"
                  aria-pressed={date === d.value}
                  onClick={() => {
                    setDate(d.value);
                    setPickDate(false);
                  }}
                  className={cn(
                    "min-h-11 rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent/60",
                    date === d.value && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {d.label}
                </button>
              ))}
              {pickDate || (date !== data.today && date !== shiftDay(data.today, -1)) ? (
                <input
                  type="date"
                  value={date}
                  max={data.today}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="h-11 rounded-full border border-primary bg-card px-4 text-sm font-medium"
                  aria-label="Pick date"
                />
              ) : (
                <button type="button" onClick={() => setPickDate(true)} className="min-h-11 rounded-full border bg-card px-4 text-sm font-medium hover:bg-accent/60">
                  Pick date…
                </button>
              )}
            </div>

            {data.recentRoutes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Recent routes</p>
                <TileGrid min="14rem">
                  {data.recentRoutes.map((r) => {
                    const on = originId === r.originId && stopIds.join("-") === r.stopIds.join("-");
                    return (
                      <Tile key={r.key} selected={on} onClick={() => pickRoute(r.originId, r.stopIds, true)}>
                        <span className="flex items-center gap-2 text-sm">
                          <RouteIcon className="size-4 shrink-0 text-primary" />
                          <RouteLine origin={r.origin} stops={r.stops} compact />
                        </span>
                        <span className="flex w-full justify-between text-xs text-muted-foreground">
                          <span>{r.trips} trips</span>
                          {r.freight !== null && <span className="num font-semibold text-foreground">{formatINR(r.freight)}</span>}
                        </span>
                      </Tile>
                    );
                  })}
                </TileGrid>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Loading point</p>
              <ChipPicker
                label="Loading point"
                options={data.loadingPoints.map((l) => ({ value: l.id, label: displayName(l.name) }))}
                value={originId ? [originId] : []}
                onChange={(v) => pickRoute((v[0] as number | undefined) ?? null, stopIds)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Destinations (tap in drop order, up to 3)</p>
              <ChipPicker
                label="Destinations"
                multiple
                max={3}
                filterable
                placeholder="Type a city"
                options={data.destinations.map((l) => ({ value: l.id, label: displayName(l.name) }))}
                value={stopIds}
                onChange={(v) => pickRoute(originId, v as number[])}
              />
            </div>
            {stopIds.length > 0 && (
              <div className="card-surface p-4 lg:hidden">
                <RouteLine origin={locName(originId)} stops={stopIds.map((s) => locName(s) ?? "?")} />
              </div>
            )}
            {originId && stopIds.length > 0 && hint && !hint.found && (
              <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">New route: no rate card yet, so enter freight and costs in Check.</p>
            )}
          </section>

          {/* c) Load */}
          <section className={section(2)} aria-label="Load">
            <SectionTitle i={2} summary={`${cars} cars · LR ${lrNo}`} />
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Cars loaded</p>
              <CarCountPicker value={cars} onChange={setCars} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">LR no.</span>
              {editLr ? (
                <input
                  value={lrNo}
                  autoFocus
                  onChange={(e) => setLrNo(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                  onBlur={() => lrNo.trim() && setEditLr(false)}
                  inputMode="text"
                  aria-label="LR number"
                  aria-invalid={error?.field === "lrNo"}
                  className={cn(
                    "num h-11 w-36 rounded-xl border bg-card px-3 text-lg font-semibold outline-none focus-visible:border-primary",
                    error?.field === "lrNo" && "border-loss",
                  )}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditLr(true)}
                  className={cn("num inline-flex min-h-11 items-center gap-2 rounded-xl border bg-card px-4 text-lg font-semibold hover:bg-muted", error?.field === "lrNo" && "border-loss text-loss")}
                  aria-label={`LR ${lrNo}, edit`}
                >
                  {lrNo}
                  <Pencil className="size-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {data.dealers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Dealer (optional)</p>
                <ChipPicker
                  label="Dealer"
                  options={data.dealers.map((d) => ({ value: d.id, label: displayName(d.name) }))}
                  value={dealerId ? [dealerId] : []}
                  onChange={(v) => setDealerId((v[0] as number | undefined) ?? null)}
                />
              </div>
            )}
          </section>

          {/* d) Check */}
          <section className={section(3)} aria-label="Check">
            <SectionTitle i={3} />
            <div className="card-surface space-y-5 p-4 @container sm:p-5">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">Diesel</span>
                  {hint?.stdDieselL ? (
                    <span className="num text-xs text-muted-foreground">Route standard {formatNumber(hint.stdDieselL)} L</span>
                  ) : null}
                </div>
                <Stepper label="Diesel litres" value={dieselL} onChange={setDieselL} step={5} decimals suffix="L" />
                {dieselRatio !== null && (
                  <div className="space-y-1" aria-label="Diesel against route standard">
                    <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-200", dieselRatio > 1.1 ? "bg-warn" : "bg-primary")}
                        style={{ width: `${Math.min(dieselRatio / 1.5, 1) * 100}%` }}
                      />
                      <span aria-hidden className="absolute top-0 bottom-0 w-0.5 bg-foreground/50" style={{ left: `${(1 / 1.5) * 100}%` }} />
                    </div>
                    <p className={cn("num text-xs", dieselRatio > 1.1 ? "font-medium text-warn" : "text-muted-foreground")}>
                      {dieselRatio > 1.1
                        ? `${Math.round((dieselRatio - 1) * 100)}% over standard. Check before saving.`
                        : `${Math.round(dieselRatio * 100)}% of standard`}
                    </p>
                  </div>
                )}
              </div>
              <div className="grid gap-4 @md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Diesel rate (per litre)</span>
                  <Stepper label="Diesel rate" value={dieselRate} onChange={setDieselRate} step={0.5} decimals prefix="₹" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">POD</span>
                  <Stepper label="POD charge" value={pod} onChange={setPod} step={50} prefix="₹" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Driver allowance</span>
                  <Stepper label="Driver allowance" value={allowance} onChange={setAllowance} step={100} prefix="₹" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Maintenance</span>
                  <Stepper label="Maintenance" value={maint} onChange={setMaint} step={100} prefix="₹" />
                </label>
              </div>
              <div className="space-y-1.5 border-t pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">Freight</span>
                  {hint?.freight !== null && hint?.freight !== undefined && money && hint.freight !== money.input.freight && (
                    <button type="button" onClick={() => setFreight(rupees(hint.freight))} className="min-h-9 rounded-full bg-warn-soft px-3 text-xs font-medium text-warn">
                      Rate card {formatINR(hint.freight)}: use it
                    </button>
                  )}
                </div>
                <Stepper label="Freight" value={freight} onChange={setFreight} step={100} decimals prefix="₹" />
              </div>
              {mode === "edit" && (
                <div className="space-y-1.5 border-t pt-4">
                  <span className="text-sm font-medium">Billing</span>
                  <div role="radiogroup" aria-label="Billing status" className="grid grid-cols-3 rounded-xl bg-muted p-1">
                    {(["UNBILLED", "INVOICED", "PAID"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={billing === s}
                        onClick={() => setBilling(s)}
                        className={cn("min-h-10 rounded-lg text-sm font-medium transition-colors", billing === s ? "bg-card shadow-sm" : "text-muted-foreground")}
                      >
                        {s === "UNBILLED" ? "Unbilled" : s === "INVOICED" ? "Invoiced" : "Paid"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="block space-y-1.5 border-t pt-4">
                <span className="text-sm font-medium">Note (optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border bg-card px-3 py-2 text-base outline-none focus-visible:border-primary"
                />
              </label>
            </div>
            <button type="button" onClick={() => void save()} disabled={saving} className={cn(primaryBtn, "hidden w-full sm:flex lg:hidden")}>
              <Check className="size-5" /> {saving ? "Saving…" : saveLabel}
            </button>
          </section>
        </div>

        {/* PC: sticky route preview + receipt */}
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:space-y-4">
          <div className="card-surface space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              {vehicle ? <NumberPlate regNo={vehicle.regNo} /> : <span className="flex items-center gap-2 text-sm text-muted-foreground"><Truck className="size-4" /> No trailer yet</span>}
              <span className="text-sm text-muted-foreground">{formatRelativeDay(parseDateOnly(date), parseDateOnly(data.today))}</span>
            </div>
            {driver && <p className="text-sm">Driver: <span className="font-medium">{displayName(driver.name)}</span></p>}
            <RouteLine origin={locName(originId)} stops={stopIds.map((s) => locName(s) ?? "?")} />
          </div>
          {receipt ? (
            <LiveReceipt {...receipt} />
          ) : (
            <div className="card-surface p-5 text-sm text-muted-foreground">Pick a route to see freight, cost and profit.</div>
          )}
          <button type="button" onClick={() => void save()} disabled={saving} className={cn(primaryBtn, "w-full")}>
            <Check className="size-5" /> {saving ? "Saving…" : saveLabel}
          </button>
        </aside>
      </div>

      {/* Phone + tablet: receipt docked above the tab bar */}
      <div className="fixed inset-x-0 bottom-[var(--dock-bottom)] z-20 px-3 lg:hidden">
        <div className="card-surface mx-auto max-w-3xl space-y-2 p-3 shadow-xl ring-1 ring-border">
          {receipt ? (
            <LiveReceipt {...receipt} compact />
          ) : (
            <p className={cn("py-1 text-center text-sm", money ? "text-muted-foreground" : "text-loss")}>
              {money ? "Pick a route to see freight and profit" : "Check the amounts"}
            </p>
          )}
          <div className="flex gap-2 sm:hidden">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="tap flex items-center justify-center rounded-xl bg-muted px-3" aria-label="Back">
                <ChevronLeft className="size-5" />
              </button>
            )}
            {step < 3 ? (
              <button type="button" onClick={() => setStep(step + 1)} disabled={!stepDone[step]} className={cn(primaryBtn, "flex-1")}>
                Next: {STEPS[step + 1]}
              </button>
            ) : (
              <button type="button" onClick={() => void save()} disabled={saving} className={cn(primaryBtn, "flex-1")}>
                <Check className="size-5" /> {saving ? "Saving…" : saveLabel}
              </button>
            )}
          </div>
          <button type="button" onClick={() => void save()} disabled={saving} className={cn(primaryBtn, "hidden w-full sm:flex")}>
            <Check className="size-5" /> {saving ? "Saving…" : saveLabel}
          </button>
        </div>
      </div>

      <ResponsiveSheet open={driverSheet} onClose={() => setDriverSheet(false)} title="Who is driving?">
        <ChipPicker
          label="Driver"
          filterable
          placeholder="Type a name"
          options={data.drivers.map((d) => ({ value: d.id, label: displayName(d.name) }))}
          value={driverId ? [driverId] : []}
          onChange={(v) => {
            setDriverId((v[0] as number | undefined) ?? null);
            if (v.length) setDriverSheet(false);
          }}
        />
      </ResponsiveSheet>

      <ResponsiveSheet open={saved !== null} onClose={() => router.push(`/trips?m=${date.slice(0, 7)}`)} title="Trip saved">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-profit-soft p-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-profit text-white">
              <Check className="size-5" />
            </span>
            <div className="text-sm">
              <p className="font-semibold">LR {lrNo} saved</p>
              {money && <p className="num text-muted-foreground">Profit {formatINR(money.profit)}</p>}
            </div>
          </div>
          <div className="grid gap-2">
            <button type="button" data-autofocus onClick={() => void again("trailer")} className={cn(primaryBtn, "w-full")}>
              Same trailer again
            </button>
            <button type="button" onClick={() => void again("route")} className="h-12 w-full rounded-xl border bg-card font-semibold hover:bg-muted">
              Same route, another trailer
            </button>
            <button type="button" onClick={() => router.push(`/trips?m=${date.slice(0, 7)}`)} className="h-12 w-full rounded-xl font-medium text-muted-foreground hover:bg-muted">
              Done
            </button>
          </div>
        </div>
      </ResponsiveSheet>
    </div>
  );
}
