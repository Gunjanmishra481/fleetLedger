import { db } from "../db";
import { invoiceDocument, nextInvoiceNo } from "../services/invoice";
import { istToday } from "@/lib/format";

/** Trips that can go on a new invoice: unbilled and not held by a draft. */
const billable = { billingStatus: "UNBILLED", invoiceId: null } as const;

export async function billingHome() {
  const [clients, groups, noClient, invoices] = await Promise.all([
    db.consignor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, billingName: true, stateCode: true, locations: { select: { id: true } } } }),
    db.trip.groupBy({ by: ["originId"], where: billable, _count: { _all: true }, _sum: { freight: true }, _min: { tripDate: true }, _max: { tripDate: true } }),
    db.location.findMany({ where: { kind: "LOADING_POINT", consignorId: null }, select: { id: true, name: true } }),
    db.invoice.findMany({
      orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
      take: 200,
      select: { id: true, number: true, invoiceDate: true, total: true, status: true, consignor: { select: { name: true } }, _count: { select: { trips: true } }, lines: true },
    }),
  ]);
  const byOrigin = new Map(groups.map((g) => [g.originId, g]));
  const ready = clients
    .map((c) => {
      const gs = c.locations.map((l) => byOrigin.get(l.id)).filter((g): g is NonNullable<typeof g> => !!g);
      return {
        id: c.id,
        name: c.name,
        billingName: c.billingName,
        trips: gs.reduce((n, g) => n + g._count._all, 0),
        amount: gs.reduce((n, g) => n + (g._sum.freight ?? 0), 0),
        from: gs.map((g) => g._min.tripDate!).sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
        to: gs.map((g) => g._max.tripDate!).sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
        hasLoadingPoints: c.locations.length > 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
  const unassigned = [...noClient.map((l) => ({ ...l, g: byOrigin.get(l.id) })), { id: null, name: "No loading point", g: byOrigin.get(null) }]
    .filter((x) => x.g)
    .map((x) => ({ id: x.id, name: x.name, trips: x.g!._count._all, amount: x.g!._sum.freight ?? 0 }));
  return {
    ready,
    unassigned,
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      invoiceDate: i.invoiceDate,
      total: i.total,
      status: i.status,
      client: i.consignor.name,
      // Cancelled invoices keep their trip list only in the snapshot.
      trips: i._count.trips || (i.lines ? (JSON.parse(i.lines) as unknown[]).length : 0),
    })),
  };
}
export type BillingHome = Awaited<ReturnType<typeof billingHome>>;

export async function newInvoiceData(consignorId: number, draftId?: number) {
  const client = await db.consignor.findUnique({ where: { id: consignorId } });
  if (!client) return null;
  const draft = draftId ? await db.invoice.findUnique({ where: { id: draftId }, select: { id: true, status: true, invoiceDate: true, consignorId: true } }) : null;
  const usable = draft && draft.status === "DRAFT" && draft.consignorId === consignorId ? draft : null;
  const trips = await db.trip.findMany({
    where: {
      origin: { consignorId },
      OR: [billable, ...(usable ? [{ invoiceId: usable.id }] : [])],
    },
    orderBy: [{ tripDate: "asc" }, { lrNo: "asc" }],
    select: {
      id: true, tripDate: true, lrNo: true, carsCount: true, freight: true, invoiceId: true,
      vehicle: { select: { regNo: true, model: true } },
      origin: { select: { name: true } },
      stops: { orderBy: { seq: "asc" }, select: { location: { select: { name: true } } } },
      _count: { select: { vins: true } },
    },
  });
  const today = istToday();
  return {
    client,
    draft: usable,
    suggested: await nextInvoiceNo(db, usable?.invoiceDate ?? today),
    today,
    trips: trips.map((t) => ({
      id: t.id,
      date: t.tripDate,
      lrNo: t.lrNo,
      regNo: t.vehicle?.regNo ?? null,
      model: t.vehicle?.model ?? null,
      origin: t.origin?.name ?? null,
      stops: t.stops.map((s) => s.location.name),
      carsCount: t.carsCount,
      freight: t.freight,
      vins: t._count.vins,
      onDraft: !!usable && t.invoiceId === usable.id,
    })),
  };
}
export type NewInvoiceData = NonNullable<Awaited<ReturnType<typeof newInvoiceData>>>;

export async function invoiceDetail(id: number) {
  const inv = await db.invoice.findUnique({
    where: { id },
    select: {
      id: true, status: true, number: true, createdBy: true, createdAt: true, issuedAt: true, paidAt: true, cancelledAt: true, consignorId: true,
      consignor: { select: { name: true } },
      trips: { select: { id: true, lrNo: true }, orderBy: { lrNo: "asc" } },
    },
  });
  if (!inv) return null;
  const [doc, audit] = await Promise.all([
    invoiceDocument(db, id, { signature: false }),
    db.auditLog.findMany({ where: { entity: "Invoice", entityId: String(id) }, orderBy: { at: "desc" }, take: 30 }),
  ]);
  return { ...inv, doc: { ...doc, signature: null }, audit: audit.map((a) => ({ id: a.id, at: a.at, user: a.user, action: a.action })) };
}
export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof invoiceDetail>>>;
