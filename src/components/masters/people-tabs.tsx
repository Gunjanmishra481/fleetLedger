"use client";

import { useMemo, useState } from "react";
import { Phone } from "lucide-react";
import { ChipPicker } from "@/components/fl/chip-picker";
import { NumberPlate } from "@/components/fl/number-plate";
import { ResponsiveSheet } from "@/components/fl/responsive-sheet";
import { Tile, TileGrid } from "@/components/fl/tile-grid";
import { displayName, initials, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  addDriverAlias,
  deleteDealer,
  mergeDrivers,
  removeDriverAlias,
  saveDealer,
  saveDriver,
  saveVehicle,
} from "@/server/actions/masters";
import type { MastersData } from "@/server/queries/masters";
import { AliasEditor, ConfirmButton, ErrorNote, Field, ListToolbar, SaveButton, Segmented, Toggle, inputCls, useSave } from "./form-bits";

type Vehicle = MastersData["vehicles"][number];
type Driver = MastersData["drivers"][number];
type Dealer = MastersData["dealers"][number];

// ---------- Trailers ----------

export function TrailersTab({ vehicles, drivers }: { vehicles: Vehicle[]; drivers: Driver[] }) {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Vehicle | "new" | null>(null);
  const shown = vehicles.filter((v) => v.regNo.includes(q.toUpperCase().replace(/\s+/g, "")));
  return (
    <div className="space-y-4">
      <ListToolbar query={q} onQuery={setQ} placeholder="Find trailer no." onAdd={() => setEdit("new")} addLabel="Add trailer" />
      <TileGrid min="13rem" gap="0.75rem">
        {shown.map((v) => (
          <Tile key={v.id} onClick={() => setEdit(v)} className={cn(!v.active && "opacity-60")} aria-label={`Edit trailer ${v.regNo}`}>
            <div className="flex w-full items-center justify-between gap-2">
              <NumberPlate regNo={v.regNo} />
              {v.ownerType === "MARKET" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">Market</span>}
            </div>
            <span className="text-sm text-muted-foreground">{v.usualDriver ? displayName(v.usualDriver) : "No usual driver"}</span>
            <span className="num text-xs text-muted-foreground">
              {plural(v.trips, "trip")}
              {!v.active && " · hidden"}
            </span>
          </Tile>
        ))}
      </TileGrid>
      {edit && <TrailerSheet key={edit === "new" ? "new" : edit.id} vehicle={edit === "new" ? null : edit} drivers={drivers} onClose={() => setEdit(null)} />}
    </div>
  );
}

function TrailerSheet({ vehicle, drivers, onClose }: { vehicle: Vehicle | null; drivers: Driver[]; onClose: () => void }) {
  const [regNo, setRegNo] = useState(vehicle?.regNo ?? "");
  const [ownerType, setOwnerType] = useState<"OWN" | "MARKET">(vehicle?.ownerType ?? "OWN");
  const [usualDriverId, setUsualDriverId] = useState<number | null>(vehicle?.usualDriverId ?? null);
  const [active, setActive] = useState(vehicle?.active ?? true);
  const { pending, error, submit } = useSave();
  return (
    <ResponsiveSheet open onClose={onClose} title={vehicle ? `Trailer ${vehicle.regNo}` : "New trailer"} desktop="side">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(() => saveVehicle({ id: vehicle?.id, regNo, ownerType, usualDriverId, active }), onClose);
        }}
      >
        <Field label="Registration no." hint="Stored in capitals without spaces">
          <input
            value={regNo}
            onChange={(e) => setRegNo(e.target.value.toUpperCase())}
            placeholder="NL01AL1658"
            autoCapitalize="characters"
            aria-invalid={error?.field === "regNo"}
            className={cn(inputCls, "num font-semibold tracking-wide")}
            data-autofocus
          />
        </Field>
        {regNo.trim() && <NumberPlate regNo={regNo.toUpperCase().replace(/[\s-]+/g, "")} size="lg" />}
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Owner</span>
          <Segmented label="Owner" value={ownerType} onChange={setOwnerType} options={[{ value: "OWN", label: "Own trailer" }, { value: "MARKET", label: "Market vehicle" }]} />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Usual driver</span>
          <p className="text-xs text-muted-foreground">Pre-selected on new trips when the trailer has no recent trips.</p>
          <ChipPicker
            label="Usual driver"
            filterable
            placeholder="Type a name"
            options={drivers.filter((d) => d.active || d.id === usualDriverId).map((d) => ({ value: d.id, label: displayName(d.name) }))}
            value={usualDriverId ? [usualDriverId] : []}
            onChange={(v) => setUsualDriverId((v[0] as number | undefined) ?? null)}
          />
        </div>
        <Toggle checked={active} onChange={setActive} label="Show in new trips" hint="Turn off for sold or retired trailers. Their trips stay." />
        <ErrorNote error={error} />
        <SaveButton pending={pending} />
      </form>
    </ResponsiveSheet>
  );
}

// ---------- Drivers ----------

export function DriversTab({ drivers }: { drivers: Driver[] }) {
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<number | "new" | null>(null);
  const shown = useMemo(() => {
    const s = q.trim().toUpperCase();
    return s ? drivers.filter((d) => d.name.includes(s) || d.aliases.some((a) => a.alias.includes(s))) : drivers;
  }, [q, drivers]);
  // Look up by id so the sheet shows fresh aliases after each save.
  const editing = editId === "new" ? null : drivers.find((d) => d.id === editId) ?? null;
  return (
    <div className="space-y-4">
      <ListToolbar query={q} onQuery={setQ} placeholder="Find driver" onAdd={() => setEditId("new")} addLabel="Add driver" />
      <TileGrid min="15rem" gap="0.75rem">
        {shown.map((d) => (
          <Tile key={d.id} onClick={() => setEditId(d.id)} className={cn("flex-row items-center", !d.active && "opacity-60")} aria-label={`Edit driver ${d.name}`}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground">{initials(d.name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{displayName(d.name)}</span>
              <span className="num block truncate text-xs text-muted-foreground">
                {plural(d.trips, "trip")}
                {d.phone ? ` · ${d.phone}` : " · no phone"}
                {!d.active && " · hidden"}
              </span>
              {d.aliases.length > 0 && <span className="block truncate text-xs text-muted-foreground">also {d.aliases.map((a) => a.alias).join(", ")}</span>}
            </span>
          </Tile>
        ))}
      </TileGrid>
      {editId !== null && (editId === "new" || editing) && (
        <DriverSheet key={editId} driver={editing} drivers={drivers} onClose={() => setEditId(null)} />
      )}
    </div>
  );
}

function DriverSheet({ driver, drivers, onClose }: { driver: Driver | null; drivers: Driver[]; onClose: () => void }) {
  const [name, setName] = useState(driver ? displayName(driver.name) : "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [active, setActive] = useState(driver?.active ?? true);
  const [mergeInto, setMergeInto] = useState<number | null>(null);
  const save = useSave();
  const side = useSave();
  const target = drivers.find((d) => d.id === mergeInto);
  return (
    <ResponsiveSheet open onClose={onClose} title={driver ? displayName(driver.name) : "New driver"} desktop="side">
      <div className="space-y-6">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.submit(() => saveDriver({ id: driver?.id, name, phone, active }), onClose);
          }}
        >
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="words" aria-invalid={save.error?.field === "name"} className={inputCls} data-autofocus />
          </Field>
          <Field label="Phone" hint="Shows a Call button on the driver page">
            <span className="relative block">
              <Phone className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="98765 43210" aria-invalid={save.error?.field === "phone"} className={cn(inputCls, "num pl-10")} />
            </span>
          </Field>
          <Toggle checked={active} onChange={setActive} label="Show in new trips" hint="Turn off for drivers who have left. Their trips stay." />
          <ErrorNote error={save.error} />
          <SaveButton pending={save.pending} />
        </form>

        {driver && (
          <>
            <div className="border-t pt-5">
              <AliasEditor
                aliases={driver.aliases}
                pending={side.pending}
                onAdd={(alias) => side.submit(() => addDriverAlias({ ownerId: driver.id, alias }))}
                onRemove={(id) => side.submit(() => removeDriverAlias(id))}
              />
            </div>
            <div className="space-y-3 border-t pt-5">
              <p className="text-sm font-medium">Same person entered twice?</p>
              <p className="text-xs text-muted-foreground">
                Merge {displayName(driver.name)} into the right name. Their {plural(driver.trips, "trip")} move over and {driver.name} becomes another spelling.
              </p>
              <ChipPicker
                label="Merge into"
                filterable
                placeholder="Type the correct name"
                options={drivers.filter((d) => d.id !== driver.id).map((d) => ({ value: d.id, label: displayName(d.name) }))}
                value={mergeInto ? [mergeInto] : []}
                onChange={(v) => setMergeInto((v[0] as number | undefined) ?? null)}
              />
              <ConfirmButton
                pending={side.pending}
                disabled={!target}
                label={target ? `Merge into ${displayName(target.name)}` : "Pick who to merge into"}
                confirmLabel={`Tap again: move ${plural(driver.trips, "trip")} to ${target ? displayName(target.name) : ""}`}
                onConfirm={() => target && side.submit(() => mergeDrivers({ fromId: driver.id, intoId: target.id }), onClose)}
              />
            </div>
            <ErrorNote error={side.error} />
          </>
        )}
      </div>
    </ResponsiveSheet>
  );
}

// ---------- Dealers ----------

export function DealersTab({ dealers }: { dealers: Dealer[] }) {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Dealer | "new" | null>(null);
  const shown = dealers.filter((d) => d.name.includes(q.trim().toUpperCase()) || (d.city ?? "").includes(q.trim().toUpperCase()));
  return (
    <div className="space-y-4">
      <ListToolbar query={q} onQuery={setQ} placeholder="Find dealer" onAdd={() => setEdit("new")} addLabel="Add dealer" />
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No dealers yet.</p>}
      <TileGrid min="15rem" gap="0.75rem">
        {shown.map((d) => (
          <Tile key={d.id} onClick={() => setEdit(d)} aria-label={`Edit dealer ${d.name}`}>
            <span className="font-semibold">{displayName(d.name)}</span>
            <span className="num text-xs text-muted-foreground">
              {[d.city && displayName(d.city), d.phone, plural(d.trips, "trip")].filter(Boolean).join(" · ")}
            </span>
          </Tile>
        ))}
      </TileGrid>
      {edit && <DealerSheet key={edit === "new" ? "new" : edit.id} dealer={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function DealerSheet({ dealer, onClose }: { dealer: Dealer | null; onClose: () => void }) {
  const [name, setName] = useState(dealer ? displayName(dealer.name) : "");
  const [city, setCity] = useState(dealer?.city ? displayName(dealer.city) : "");
  const [phone, setPhone] = useState(dealer?.phone ?? "");
  const save = useSave();
  const del = useSave();
  return (
    <ResponsiveSheet open onClose={onClose} title={dealer ? displayName(dealer.name) : "New dealer"} desktop="side">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.submit(() => saveDealer({ id: dealer?.id, name, city, phone }), onClose);
        }}
      >
        <Field label="Dealer name">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={save.error?.field === "name"} className={inputCls} data-autofocus />
        </Field>
        <Field label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" aria-invalid={save.error?.field === "phone"} className={cn(inputCls, "num")} />
        </Field>
        <ErrorNote error={save.error} />
        <SaveButton pending={save.pending} />
        {dealer && (
          <>
            <ConfirmButton
              pending={del.pending}
              disabled={dealer.trips > 0}
              label={dealer.trips > 0 ? `On ${plural(dealer.trips, "trip")}, so it can't be deleted` : "Delete dealer"}
              confirmLabel="Tap again to delete"
              onConfirm={() => del.submit(() => deleteDealer(dealer.id), onClose)}
            />
            <ErrorNote error={del.error} />
          </>
        )}
      </form>
    </ResponsiveSheet>
  );
}
