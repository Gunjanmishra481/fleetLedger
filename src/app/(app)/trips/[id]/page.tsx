import { redirect } from "next/navigation";

// Temporary until the trip detail page (design step 5): open the editor.
export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const [{ id }, { m }] = await Promise.all([params, searchParams]);
  redirect(`/trips/${id}/edit${m ? `?m=${m}` : ""}`);
}
