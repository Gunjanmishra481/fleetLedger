import { TripFlow } from "@/components/trips/trip-flow";
import { parseMonth } from "@/lib/month";
import { tripForEdit, tripFormData, type TripPrefill } from "@/server/queries/trip-form";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const id = (v: string | string[] | undefined) => {
  const n = Number(one(v));
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/**
 * New trip. Optional pre-fills:
 *   ?vehicle=ID             trailer picked (Home "idle trailer" tap)
 *   ?copy=TRIP_ID           duplicate a trip (new LR and today's date)
 *   ?route=ORIGIN:STOP-STOP same route, pick another trailer
 */
export default async function NewTripPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const data = await tripFormData();
  let prefill: Partial<TripPrefill> | undefined;

  const copyId = id(sp.copy);
  if (copyId) {
    const t = await tripForEdit(copyId);
    if (t) {
      const { id: _id, lrNo: _lr, tripDate: _d, billingStatus: _b, notes: _n, ...rest } = t;
      prefill = rest;
    }
  }
  const vehicle = id(sp.vehicle);
  if (vehicle && data.vehicles.some((v) => v.id === vehicle)) prefill = { ...prefill, vehicleId: vehicle };
  const route = one(sp.route)?.match(/^(\d+):(\d+(?:-\d+){0,2})$/);
  if (route) prefill = { ...prefill, originId: Number(route[1]), stopIds: route[2].split("-").map(Number) };

  return <TripFlow data={data} prefill={prefill} month={parseMonth(sp.m)} />;
}
