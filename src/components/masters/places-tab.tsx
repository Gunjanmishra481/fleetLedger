"use client";

import { useMemo, useState } from "react";
import { ChipPicker } from "@/components/fl/chip-picker";
import { ResponsiveSheet } from "@/components/fl/responsive-sheet";
import { Tile, TileGrid } from "@/components/fl/tile-grid";
import { displayName, plural } from "@/lib/format";
import { addLocationAlias, mergeLocations, removeLocationAlias, saveLocation } from "@/server/actions/masters";
import type { MastersData } from "@/server/queries/masters";
import { AliasEditor, ConfirmButton, ErrorNote, Field, ListToolbar, SaveButton, Segmented, inputCls, useSave } from "./form-bits";

type Place = MastersData["locations"][number];
type Kind = Place["kind"];

export function PlacesTab({ locations }: { locations: Place[] }) {
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<number | "new" | null>(null);
  const shown = useMemo(() => {
    const s = q.trim().toUpperCase();
    return s ? locations.filter((l) => l.name.includes(s) || l.aliases.some((a) => a.alias.includes(s))) : locations;
  }, [q, locations]);
  const editing = editId === "new" ? null : locations.find((l) => l.id === editId) ?? null;

  const group = (kind: Kind, title: string) => {
    const list = shown.filter((l) => l.kind === kind);
    if (!list.length) return null;
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {title} ({list.length})
        </h2>
        <TileGrid min="12rem" gap="0.625rem">
          {list.map((l) => (
            <Tile key={l.id} onClick={() => setEditId(l.id)} aria-label={`Edit ${l.name}`}>
              <span className="font-semibold">{displayName(l.name)}</span>
              <span className="num text-xs text-muted-foreground">
                {plural(l.uses, "trip")}
                {l.district && ` · ${displayName(l.district)}`}
              </span>
              {l.aliases.length > 0 && <span className="truncate text-xs text-muted-foreground">also {l.aliases.map((a) => a.alias).join(", ")}</span>}
            </Tile>
          ))}
        </TileGrid>
      </section>
    );
  };

  return (
    <div className="space-y-5">
      <ListToolbar query={q} onQuery={setQ} placeholder="Find a place" onAdd={() => setEditId("new")} addLabel="Add place" />
      {group("LOADING_POINT", "Loading points")}
      {group("DESTINATION", "Destinations")}
      {editId !== null && (editId === "new" || editing) && (
        <PlaceSheet key={editId} place={editing} places={locations} onClose={() => setEditId(null)} />
      )}
    </div>
  );
}

function PlaceSheet({ place, places, onClose }: { place: Place | null; places: Place[]; onClose: () => void }) {
  const [name, setName] = useState(place ? displayName(place.name) : "");
  const [kind, setKind] = useState<Kind>(place?.kind ?? "DESTINATION");
  const [district, setDistrict] = useState(place?.district ? displayName(place.district) : "");
  const [mergeInto, setMergeInto] = useState<number | null>(null);
  const save = useSave();
  const side = useSave();
  const target = places.find((p) => p.id === mergeInto);
  return (
    <ResponsiveSheet open onClose={onClose} title={place ? displayName(place.name) : "New place"} desktop="side">
      <div className="space-y-6">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.submit(() => saveLocation({ id: place?.id, name, kind, district }), onClose);
          }}
        >
          <Field label="Name" hint='For loading points include the yard, e.g. "OCPL (Detroj)"'>
            <input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={save.error?.field === "name"} className={inputCls} data-autofocus />
          </Field>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Type</span>
            <Segmented label="Type" value={kind} onChange={setKind} options={[{ value: "LOADING_POINT", label: "Loading point" }, { value: "DESTINATION", label: "Destination" }]} />
          </div>
          <Field label="District (optional)">
            <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputCls} />
          </Field>
          <ErrorNote error={save.error} />
          <SaveButton pending={save.pending} />
        </form>

        {place && (
          <>
            <div className="border-t pt-5">
              <AliasEditor
                aliases={place.aliases}
                pending={side.pending}
                onAdd={(alias) => side.submit(() => addLocationAlias({ ownerId: place.id, alias }))}
                onRemove={(id) => side.submit(() => removeLocationAlias(id))}
              />
            </div>
            <div className="space-y-3 border-t pt-5">
              <p className="text-sm font-medium">Same place entered twice?</p>
              <p className="text-xs text-muted-foreground">
                Merge {displayName(place.name)} into the right name. Its {plural(place.uses, "trip")} and rate cards move over and {place.name} becomes another spelling.
              </p>
              <ChipPicker
                label="Merge into"
                filterable
                placeholder="Type the correct place"
                options={places.filter((p) => p.id !== place.id).map((p) => ({ value: p.id, label: displayName(p.name) }))}
                value={mergeInto ? [mergeInto] : []}
                onChange={(v) => setMergeInto((v[0] as number | undefined) ?? null)}
              />
              <ConfirmButton
                pending={side.pending}
                disabled={!target}
                label={target ? `Merge into ${displayName(target.name)}` : "Pick where to merge into"}
                confirmLabel={`Tap again: move everything to ${target ? displayName(target.name) : ""}`}
                onConfirm={() => target && side.submit(() => mergeLocations({ fromId: place.id, intoId: target.id }), onClose)}
              />
            </div>
            <ErrorNote error={side.error} />
          </>
        )}
      </div>
    </ResponsiveSheet>
  );
}
