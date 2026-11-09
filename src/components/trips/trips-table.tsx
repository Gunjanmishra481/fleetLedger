"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TripRow } from "@/server/queries/trips";
import type { Flag } from "@/server/services/trip";

export type TripTableRow = TripRow & { flags: Flag[] };

const money = (v: number) => formatINR(v);
type Sum = "sum" | undefined;

// SEP-26 column order, so the register reads like the sheet.
const COLS: { id: keyof TripTableRow; header: string; num?: boolean; sum?: Sum; cell?: (r: TripTableRow) => React.ReactNode; hidden?: boolean }[] = [
  { id: "serialNo", header: "F", num: true },
  { id: "date", header: "Date", cell: (r) => formatDate(new Date(r.date)) },
  { id: "regNo", header: "Trailer No" },
  { id: "driver", header: "Driver", cell: (r) => r.driver ?? <span className="text-amber-700">—</span> },
  { id: "lrNo", header: "LR No" },
  { id: "origin", header: "From" },
  { id: "destination", header: "Destination" },
  { id: "carsCount", header: "Cars", num: true, sum: "sum" },
  { id: "dieselL", header: "Diesel L", num: true, sum: "sum", cell: (r) => formatNumber(r.dieselL) },
  { id: "dieselRate", header: "Rate/L", num: true, cell: (r) => formatINR(r.dieselRate, { decimals: true }), hidden: true },
  { id: "dieselAmount", header: "Diesel ₹", num: true, sum: "sum", cell: (r) => money(r.dieselAmount) },
  { id: "podCharge", header: "POD", num: true, sum: "sum", cell: (r) => money(r.podCharge) },
  { id: "maintenance", header: "Maint", num: true, sum: "sum", cell: (r) => (r.maintenance ? money(r.maintenance) : ""), hidden: true },
  { id: "driverAllowance", header: "Trip", num: true, sum: "sum", cell: (r) => money(r.driverAllowance) },
  { id: "totalCost", header: "Total Cost", num: true, sum: "sum", cell: (r) => money(r.totalCost) },
  { id: "freight", header: "Revenue", num: true, sum: "sum", cell: (r) => money(r.freight) },
  {
    id: "profit",
    header: "Profit/Loss",
    num: true,
    sum: "sum",
    cell: (r) => <span className={r.profit < 0 ? "text-red-600" : "text-emerald-700"}>{money(r.profit)}</span>,
  },
  {
    id: "billingStatus",
    header: "Billing",
    cell: (r) => (r.billingStatus === "UNBILLED" ? <span className="text-muted-foreground">Unbilled</span> : r.billingStatus === "PAID" ? "Paid" : "Invoiced"),
  },
  { id: "dealer", header: "Dealer", cell: (r) => r.dealer ?? "" },
  {
    id: "flags",
    header: "Flags",
    cell: (r) =>
      r.flags.length ? (
        <span className="inline-flex flex-wrap gap-1">
          {r.flags.map((f) => (
            <span key={f.kind} title={f.label} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
              {f.kind.replace("_", " ").toLowerCase()}
            </span>
          ))}
        </span>
      ) : null,
  },
];

export function TripsTable({ rows, month }: { rows: TripTableRow[]; month: string }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(COLS.filter((c) => c.hidden).map((c) => [c.id, false])),
  );
  const [chooser, setChooser] = useState(false);

  const columns = useMemo<ColumnDef<TripTableRow>[]>(
    () =>
      COLS.map((c) => ({
        id: c.id,
        accessorFn: (r) => (c.id === "flags" ? r.flags.length : r[c.id]),
        header: c.header,
        cell: ({ row }) => (c.cell ? c.cell(row.original) : String(row.original[c.id] ?? "")),
        meta: { num: c.num, sum: c.sum },
      })),
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of COLS) if (c.sum) t[c.id] = rows.reduce((s, r) => s + (r[c.id] as number), 0);
    return t;
  }, [rows]);

  return (
    <div className="space-y-2">
      <div className="relative flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setChooser((v) => !v)}>
          <Columns3 className="size-4" /> Columns
        </Button>
        {chooser && (
          <div className="absolute top-9 right-0 z-20 grid w-56 gap-1 rounded-md border bg-popover p-2 text-sm shadow-md">
            {table.getAllLeafColumns().map((col) => (
              <label key={col.id} className="flex items-center gap-2">
                <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()} />
                {String(col.columnDef.header)}
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="max-h-[calc(100vh-15rem)] overflow-auto rounded-md border">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const num = (h.column.columnDef.meta as { num?: boolean })?.num;
                  const dir = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      className={cn("h-9 cursor-pointer border-b px-2 font-medium whitespace-nowrap select-none", num ? "text-right" : "text-left")}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {dir === "asc" ? " ▲" : dir === "desc" ? " ▼" : ""}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => router.push(`/trips/${row.original.id}?m=${month}`)}
                className="h-9 cursor-pointer border-b hover:bg-muted/50"
              >
                {row.getVisibleCells().map((cell) => {
                  const num = (cell.column.columnDef.meta as { num?: boolean })?.num;
                  return (
                    <td key={cell.id} className={cn("px-2 whitespace-nowrap", num && "text-right tabular-nums")}>
                      {cell.column.id === "lrNo" ? (
                        <Link href={`/trips/${row.original.id}?m=${month}`} className="underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                          {row.original.lrNo}
                        </Link>
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="p-6 text-center text-muted-foreground">
                  No trips match. Change the month or filters, or add a trip.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 bg-muted font-semibold">
              <tr className="h-9">
                {table.getVisibleLeafColumns().map((col, i) => {
                  const c = COLS.find((x) => x.id === col.id)!;
                  let v: React.ReactNode = "";
                  if (i === 0) v = `${rows.length}`;
                  else if (c.sum) {
                    const n = totals[c.id];
                    v = c.id === "carsCount" || c.id === "dieselL" ? formatNumber(n) : formatINR(n);
                  }
                  return (
                    <td key={col.id} className={cn("px-2 whitespace-nowrap", c.num && "text-right tabular-nums", c.id === "profit" && totals.profit < 0 && "text-red-600")}>
                      {v}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
