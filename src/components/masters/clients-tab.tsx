"use client";

import { useState } from "react";
import { ChipPicker } from "@/components/fl/chip-picker";
import { ResponsiveSheet } from "@/components/fl/responsive-sheet";
import { Tile, TileGrid } from "@/components/fl/tile-grid";
import { COMPANY } from "@/config/company";
import { displayName, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { saveConsignor } from "@/server/actions/masters";
import { sameState } from "@/server/invoice/maths";
import type { MastersData } from "@/server/queries/masters";
import { ErrorNote, Field, ListToolbar, SaveButton, inputCls, useSave } from "./form-bits";

type Client = MastersData["consignors"][number];
type Place = MastersData["locations"][number];

/** Clients (Bill To on invoices) and the loading points whose trips they pay for. */
export function ClientsTab({ clients, locations }: { clients: Client[]; locations: Place[] }) {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Client | "new" | null>(null);
  const s = q.trim().toUpperCase();
  const shown = s ? clients.filter((c) => c.name.includes(s) || c.billingName.toUpperCase().includes(s)) : clients;
  const loading = locations.filter((l) => l.kind === "LOADING_POINT");
  const owner = new Map(clients.flatMap((c) => c.locations.map((l) => [l.id, c.name] as const)));
  const orphans = loading.filter((l) => !owner.has(l.id));
  return (
    <div className="space-y-4">
      <ListToolbar query={q} onQuery={setQ} placeholder="Find client" onAdd={() => setEdit("new")} addLabel="Add client" />
      {orphans.length > 0 && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          Loading points with no client (their trips can't be invoiced yet): {orphans.map((l) => displayName(l.name)).join(", ")}
        </p>
      )}
      <TileGrid min="17rem" gap="0.75rem">
        {shown.map((c) => (
          <Tile key={c.id} onClick={() => setEdit(c)} aria-label={`Edit client ${c.name}`}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-lg font-semibold">{c.name}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", sameState(COMPANY.stateCodeForGst, c.stateCode) ? "bg-accent text-accent-foreground" : "bg-muted")}>
                {sameState(COMPANY.stateCodeForGst, c.stateCode) ? "CGST + SGST" : "IGST"}
              </span>
            </span>
            <span className="line-clamp-2 text-sm text-muted-foreground">{c.billingName}</span>
            <span className="text-xs text-muted-foreground">
              {c.locations.length ? c.locations.map((l) => displayName(l.name)).join(", ") : "No loading point yet"} · {plural(c.invoices, "invoice")}
            </span>
          </Tile>
        ))}
      </TileGrid>
      {edit && <ClientSheet key={edit === "new" ? "new" : edit.id} client={edit === "new" ? null : edit} loading={loading} owner={owner} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ClientSheet({ client, loading, owner, onClose }: { client: Client | null; loading: Place[]; owner: Map<number, string>; onClose: () => void }) {
  const [name, setName] = useState(client?.name ?? "");
  const [billingName, setBillingName] = useState(client?.billingName ?? "");
  const [address, setAddress] = useState((client?.addressLines ?? []).join("\n"));
  const [gstin, setGstin] = useState(client?.gstin ?? "");
  const [pan, setPan] = useState(client?.pan ?? "");
  const [state, setState] = useState(client?.state ?? "");
  const [stateCode, setStateCode] = useState(client?.stateCode ?? "");
  const [handlingLabel, setHandlingLabel] = useState(client?.handlingLabel ?? "");
  const [locationIds, setLocationIds] = useState<number[]>(client?.locations.map((l) => l.id) ?? []);
  const { pending, error, submit } = useSave();
  const moved = locationIds.filter((id) => owner.has(id) && owner.get(id) !== client?.name);
  return (
    <ResponsiveSheet open onClose={onClose} title={client ? `Client ${client.name}` : "New client"} desktop="side">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(
            () => saveConsignor({ id: client?.id, name, billingName, addressLines: address.split("\n"), gstin, pan, state, stateCode, handlingLabel, locationIds }),
            onClose,
          );
        }}
      >
        <Field label="Short name" hint="Used on screens, e.g. JKTI">
          <input value={name} onChange={(e) => setName(e.target.value.toUpperCase())} aria-invalid={error?.field === "name"} className={inputCls} data-autofocus />
        </Field>
        <Field label="Billing name (Bill To)">
          <input value={billingName} onChange={(e) => setBillingName(e.target.value)} aria-invalid={error?.field === "billingName"} className={inputCls} />
        </Field>
        <Field label="Address" hint="One line per row; printed under the billing name">
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className={cn(inputCls, "h-auto py-3")} />
        </Field>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(10rem,100%),1fr))]">
          <Field label="GSTIN">
            <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} aria-invalid={error?.field === "gstin"} className={inputCls} />
          </Field>
          <Field label="PAN">
            <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} aria-invalid={error?.field === "pan"} className={inputCls} />
          </Field>
          <Field label="State">
            <input value={state} onChange={(e) => setState(e.target.value)} className={inputCls} />
          </Field>
          <Field label="GST state code" hint={stateCode ? (sameState(COMPANY.stateCodeForGst, stateCode) ? "Same as Mahakal: CGST + SGST" : "Other state: IGST 18%") : "Empty: IGST 18%"}>
            <input value={stateCode} onChange={(e) => setStateCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-invalid={error?.field === "stateCode"} className={cn(inputCls, "num")} />
          </Field>
        </div>
        <Field label="Place of Handling (invoice column)" hint='e.g. "JKTI (CE)"'>
          <input value={handlingLabel} onChange={(e) => setHandlingLabel(e.target.value)} className={inputCls} />
        </Field>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Loading points billed to this client</span>
          <ChipPicker
            label="Loading points"
            multiple
            options={loading.map((l) => ({ value: l.id, label: displayName(l.name), hint: owner.has(l.id) && owner.get(l.id) !== client?.name ? owner.get(l.id) : undefined }))}
            value={locationIds}
            onChange={(v) => setLocationIds(v as number[])}
          />
          {moved.length > 0 && <p className="text-xs text-warn">{plural(moved.length, "loading point")} will move from another client to this one.</p>}
        </div>
        <ErrorNote error={error} />
        <SaveButton pending={pending} />
      </form>
    </ResponsiveSheet>
  );
}
