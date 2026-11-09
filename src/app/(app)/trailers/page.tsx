import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  redirect(`/fleet?tab=trailers${m ? `&m=${m}` : ""}`);
}
