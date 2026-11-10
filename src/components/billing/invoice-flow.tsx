"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ClipboardPaste, FileSpreadsheet, Pencil } from "lucide-react";
import { CarIcons } from "@/components/fl/car-count";
import { MissingPlate, NumberPlate } from "@/components/fl/number-plate";
import { RouteLine } from "@/components/fl/route-line";
import { Tile, TileGrid } from "@/components/fl/tile-grid";
import { COMPANY } from "@/config/company";
import { formatINR, formatRelativeDay, formatRupees, plural } from "@/lib/format";
import { fyPeriod } from "@/lib/fy";
import { parseDateOnly, toDateInput } from "@/lib/schemas/trip";
import { cn } from "@/lib/utils";
import { checkVinSheet, issueInvoiceAction, saveInvoiceDraft, suggestInvoiceNumber } from "@/server/actions/billing";
import { computeInvoice } from "@/server/invoice/maths";
import type { InvoiceLine, VinRow } from "@/server/invoice/reference";
import type { VinMatchReport } from "@/server/invoice/vins";
import type { NewInvoiceData } from "@/server/queries/billing";
import { InvoicePaper } from "./invoice-paper";

const STEPS = ["Trips", "VINs", "Review"] as const;
type Range = "month" | "last" | "all" | "custom";

const monthBounds = (d: Date, back: number) => {
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
  const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back + 1, 0));
  return [s, e] as const;
};

export function InvoiceFlow({ data }: { data: NewInvoiceData }) {
  const router = useRouter();
  const today = new Date(data.today);
  const [step, setStep] = useState(0);
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState(toDateInput(data.trips[0]?.date ? new Date(data.trips[0].date) : today));
  const [to, setTo] = useState(toDateInput(today));
  const [selected, setSelected] = useState<Set<number>>(() => new Set(data.trips.filter((t) => t.onDraft).map((t) => t.id)));
  const [vinRows, setVinRows] = useState<VinRow[] | null>(null);
  const [report, setReport] = useState<VinMatchReport | null>(null);
  const [vinMode, setVinMode] = useState<"upload" | "paste">("upload");
  const [pasted, setPasted] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(toDateInput(data.draft ? new Date(data.draft.invoiceDate) : today));
  const [number, setNumber] = useState(data.suggested.number);
  const [numberEdited, setNumberEdited] = useState(false);
  const [editNumber, setEditNumber] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    if (range === "all") return data.trips;
    const [s, e] =
      range === "month" ? monthBounds(today, 0) : range === "last" ? monthBounds(today, 1) : ([parseDateOnly(from), parseDateOnly(to)] as const);
    return data.trips.filter((t) => {
      const d = new Date(t.date).getTime();
      return d >= s.getTime() && d <= e.getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, from, to, data.trips]);

  const chosen = data.trips.filter((t) => selected.has(t.id));
  const totals = computeInvoice({ amounts: chosen.map((t) => t.freight), sellerStateCode: COMPANY.stateCodeForGst, buyerStateCode: data.client.stateCode });
  const allShownSelected = shown.length > 0 && shown.every((t) => selected.has(t.id));
  const vinsFor = (tripId: number) => report?.trips.find((r) => r.tripId === tripId);

  function toggle(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setReport(null); // a new selection needs a new VIN check
  }
  function selectAllShown() {
    setSelected((s) => {
      const n = new Set(s);
      if (allShownSelected) shown.forEach((t) => n.delete(t.id));
      else shown.forEach((t) => n.add(t.id));
      return n;
    });
    setReport(null);
  }

  function runVinCheck(file?: File) {
    setError(null);
    const fd = new FormData();
    fd.set("tripIds", JSON.stringify([...selected]));
    if (file) fd.set("file", file);
    else fd.set("text", pasted);
    start(async () => {
      const r = await checkVinSheet(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setVinRows(r.data.rows);
      setReport(r.data.report);
    });
  }

  function onDate(v: string) {
    setInvoiceDate(v);
    if (!numberEdited) start(async () => setNumber(await suggestInvoiceNumber(v)));
  }

  const payload = () => ({
    consignorId: data.client.id,
    tripIds: [...selected],
    invoiceDate,
    number: numberEdited ? number : null,
    vinRows,
    draftId: data.draft?.id ?? null,
  });

  function issue() {
    setError(null);
    start(async () => {
      const r = await issueInvoiceAction(payload());
      if (!r.ok) setError(r.error);
      else router.push(`/billing/${r.data.id}`);
    });
  }
  function draft() {
    setError(null);
    start(async () => {
      const r = await saveInvoiceDraft(payload());
      if (!r.ok) setError(r.error);
      else router.push(`/billing/${r.data.id}`);
    });
  }

  // Preview lines, exactly as the issued invoice will have them.
  const lines: InvoiceLine[] = chosen
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || (Number(a.lrNo) || 0) - (Number(b.lrNo) || 0))
    .map((t) => ({
      carrierNo: t.regNo ?? "",
      model: t.model,
      lrNo: t.lrNo,
      vins: vinsFor(t.id)?.vins.length || t.vins || t.carsCount,
      handling: data.client.handlingLabel,
      delivery: t.stops.join(" + "),
      tptr: COMPANY.transporterShortName,
      dispDate: new Date(t.date),
      amount: t.freight,
    }));
  const doc = {
    seller: { ...COMPANY, addressLines: [...COMPANY.addressLines], bank: { ...COMPANY.bank } },
    buyer: { ...data.client },
    number,
    invoiceDate: parseDateOnly(invoiceDate),
    period: fyPeriod(parseDateOnly(invoiceDate)),
    placeOfSupply: COMPANY.placeOfSupply,
    lines,
    totals,
  };
  const warnings = report?.trips.filter((t) => !t.ok).length ?? 0;
  const primary = "flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
  const chip = (on: boolean) => cn("min-h-11 rounded-full border bg-card px-4 text-sm font-medium hover:bg-muted", on && "border-primary bg-primary text-primary-foreground hover:bg-primary/90");

  const summary = (
    <div className="num space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">{plural(chosen.length, "trip")} · {chosen.reduce((n, t) => n + t.carsCount, 0)} cars</span>
        <span>{formatINR(totals.subtotal)}</span>
      </div>
      {totals.intraState ? (
        <div className="flex justify-between text-muted-foreground">
          <span>CGST 9% + SGST 9%</span>
          <span>{formatINR(totals.cgst + totals.sgst)}</span>
        </div>
      ) : (
        <div className="flex justify-between text-muted-foreground">
          <span>IGST 18%</span>
          <span>{formatINR(totals.igst)}</span>
        </div>
      )}
      <div className="flex justify-between border-t pt-1 text-base font-bold">
        <span>Total</span>
        <span>{formatRupees(totals.total)}</span>
      </div>
    </div>
  );

  return (
    <div className="pb-40 lg:pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/billing" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted">
            <ChevronLeft className="size-4" /> Billing
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.draft ? "Draft invoice" : "New invoice"} · {data.client.name}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{data.client.billingName}</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2" role="tablist" aria-label="Steps">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={step === i}
            disabled={i > 0 && chosen.length === 0}
            onClick={() => setStep(i)}
            className={cn("flex min-h-11 flex-col items-start justify-center gap-1 rounded-xl px-2 text-left text-sm font-medium disabled:opacity-40", step === i ? "text-foreground" : "text-muted-foreground")}
          >
            <span className={cn("h-1.5 w-full rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-loss-soft px-4 py-3 text-sm font-medium text-loss">
          {error}
        </p>
      )}

      <div className={cn(step < 2 && "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6")}>
        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
                {([
                  ["all", "All unbilled"],
                  ["month", "This month"],
                  ["last", "Last month"],
                  ["custom", "Pick dates"],
                ] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)} className={chip(range === k)}>
                    {l}
                  </button>
                ))}
              </div>
              {range === "custom" && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    From <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-11 rounded-xl border bg-card px-3" />
                  </label>
                  <label className="flex items-center gap-2">
                    to <input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-11 rounded-xl border bg-card px-3" />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{plural(shown.length, "unbilled trip")} in this range</p>
                <button type="button" onClick={selectAllShown} disabled={!shown.length} className="min-h-11 rounded-xl border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50">
                  {allShownSelected ? "Clear these" : `Select all ${shown.length}`}
                </button>
              </div>
              <TileGrid min="16rem" gap="0.625rem">
                {shown.map((t) => (
                  <Tile key={t.id} selected={selected.has(t.id)} onClick={() => toggle(t.id)} aria-label={`LR ${t.lrNo}, ${formatRupees(t.freight)}`}>
                    <span className="flex w-full items-center justify-between gap-2">
                      {t.regNo ? <NumberPlate regNo={t.regNo} size="sm" /> : <MissingPlate size="sm" />}
                      <span className={cn("flex size-6 items-center justify-center rounded-full border-2", selected.has(t.id) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30")}>
                        {selected.has(t.id) && <Check className="size-4" />}
                      </span>
                    </span>
                    <RouteLine origin={t.origin} stops={t.stops} compact />
                    <span className="num flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <CarIcons count={t.carsCount} /> LR {t.lrNo}
                      </span>
                      <span>{formatRelativeDay(new Date(t.date), today)}</span>
                    </span>
                    <span className="num text-base font-semibold">{formatRupees(t.freight)}</span>
                  </Tile>
                ))}
              </TileGrid>
              {shown.length === 0 && <p className="card-surface p-5 text-sm text-muted-foreground">No unbilled trips for {data.client.name} in this range.</p>}
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload the VIN sheet {data.client.name} sent (columns like “VIN DETAILS”), or copy its rows from Excel and paste them. Rows are matched to trips by LR NO.
                You can also skip this and issue without VINs.
              </p>
              <div className="flex gap-2" role="group" aria-label="How to add VINs">
                <button type="button" aria-pressed={vinMode === "upload"} onClick={() => setVinMode("upload")} className={chip(vinMode === "upload")}>
                  <FileSpreadsheet className="mr-1.5 inline size-4" /> Upload .xlsx
                </button>
                <button type="button" aria-pressed={vinMode === "paste"} onClick={() => setVinMode("paste")} className={chip(vinMode === "paste")}>
                  <ClipboardPaste className="mr-1.5 inline size-4" /> Paste rows
                </button>
              </div>
              {vinMode === "upload" ? (
                <div className="card-surface flex flex-wrap items-center gap-3 p-4">
                  <input ref={fileRef} type="file" accept=".xlsx" className="sr-only" onChange={(e) => e.target.files?.[0] && runVinCheck(e.target.files[0])} aria-label="VIN sheet" />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={pending} className={primary}>
                    <FileSpreadsheet className="size-5" /> {pending ? "Checking…" : "Choose VIN sheet"}
                  </button>
                </div>
              ) : (
                <div className="card-surface space-y-3 p-4">
                  <textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    rows={6}
                    placeholder="Paste rows here (VIN NO, MODEL, MANUFACTURER, … , CARRIER NO, DISP DATE, LR NO)"
                    className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:border-primary"
                    aria-label="Pasted VIN rows"
                  />
                  <button type="button" onClick={() => runVinCheck()} disabled={pending || !pasted.trim()} className={primary}>
                    {pending ? "Checking…" : "Check rows"}
                  </button>
                </div>
              )}
              {report && (
                <div className="space-y-3">
                  <p className={cn("rounded-xl px-4 py-3 text-sm font-medium", warnings ? "bg-warn-soft text-warn" : "bg-profit-soft text-profit")}>
                    {report.matchedRows} of {report.totalRows} VINs matched to {plural(report.trips.filter((t) => t.vins.length).length, "trip")}.
                    {warnings ? ` ${plural(warnings, "trip")} need a look.` : " Everything matches."}
                  </p>
                  {report.unknownLr.length > 0 && (
                    <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
                      Not on this invoice: {report.unknownLr.map((u) => `LR ${u.lrNo} (${plural(u.vins, "VIN")})`).join(", ")}
                    </p>
                  )}
                  <ul className="card-surface divide-y overflow-hidden">
                    {report.trips.map((r) => {
                      const t = data.trips.find((x) => x.id === r.tripId)!;
                      return (
                        <li key={r.tripId} className="flex items-start gap-3 p-3">
                          {r.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-profit" aria-label="Matched" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-label="Check" />}
                          <div className="min-w-0 flex-1 text-sm">
                            <p className="num font-medium">
                              LR {r.lrNo} · {t.regNo ?? "no trailer"} · {plural(r.vins.length, "VIN")} / {t.carsCount} cars
                            </p>
                            {r.warnings.map((w) => (
                              <p key={w} className="text-warn">
                                {w}
                              </p>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <div className="space-y-4 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
              <div className="card-surface space-y-4 p-4 lg:sticky lg:top-24">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Invoice date</span>
                  <input type="date" value={invoiceDate} onChange={(e) => e.target.value && onDate(e.target.value)} className="h-12 w-full rounded-xl border bg-card px-3 text-base" />
                </label>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Invoice number</span>
                  {editNumber ? (
                    <input
                      value={number}
                      autoFocus
                      onChange={(e) => {
                        setNumber(e.target.value.toUpperCase().replace(/\s+/g, ""));
                        setNumberEdited(true);
                      }}
                      onBlur={() => setEditNumber(false)}
                      className="num h-12 w-full rounded-xl border bg-card px-3 text-base font-semibold"
                      aria-label="Invoice number"
                    />
                  ) : (
                    <button type="button" onClick={() => setEditNumber(true)} className="num flex h-12 w-full items-center justify-between rounded-xl border bg-card px-3 text-base font-semibold hover:bg-muted">
                      {number} <Pencil className="size-4 text-muted-foreground" />
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground">{numberEdited ? "Your number will be used (checked for duplicates)." : "Next in the series. Tap to change."}</p>
                </div>
                <div className="rounded-xl bg-muted p-3">{summary}</div>
                <p className="text-xs text-muted-foreground">
                  {totals.intraState ? "Same state code as Mahakal: CGST + SGST." : `Client state code ${data.client.stateCode ?? "not set"} ≠ ${COMPANY.stateCodeForGst}: IGST.`}
                  {report ? ` ${plural(report.matchedRows, "VIN")} attached.` : " No VIN sheet: VIN counts use each trip's cars."}
                </p>
                <button type="button" onClick={issue} disabled={pending || !chosen.length} className={cn(primary, "w-full")}>
                  <Check className="size-5" /> {pending ? "Issuing…" : "Issue invoice"}
                </button>
                <button type="button" onClick={draft} disabled={pending || !chosen.length} className="h-12 w-full rounded-xl border bg-card font-semibold hover:bg-muted disabled:opacity-50">
                  Save as draft
                </button>
              </div>
              <div className="min-w-0">
                <p className="mb-2 text-sm text-muted-foreground">Preview: the invoice as it will print and download.</p>
                <div className="overflow-hidden rounded-xl shadow-lg ring-1 ring-border">
                  <InvoicePaper doc={doc} watermark="Preview" className="p-[2cqw]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {step < 2 && (
          <aside className="hidden lg:sticky lg:top-24 lg:block">
            <div className="card-surface space-y-4 p-5">
              <p className="font-semibold">Invoice so far</p>
              {summary}
              <button type="button" onClick={() => setStep(step + 1)} disabled={!chosen.length} className={cn(primary, "w-full")}>
                Next: {STEPS[step + 1]}
              </button>
            </div>
          </aside>
        )}
      </div>

      {step < 2 && (
        <div className="fixed inset-x-0 bottom-[var(--dock-bottom)] z-20 px-3 lg:hidden">
          <div className="card-surface mx-auto max-w-3xl space-y-2 p-3 shadow-xl ring-1 ring-border">
            {summary}
            <div className="flex gap-2">
              {step > 0 && (
                <button type="button" onClick={() => setStep(step - 1)} className="tap flex items-center justify-center rounded-xl bg-muted px-3" aria-label="Back">
                  <ChevronLeft className="size-5" />
                </button>
              )}
              <button type="button" onClick={() => setStep(step + 1)} disabled={!chosen.length} className={cn(primary, "flex-1")}>
                Next: {STEPS[step + 1]}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
