// Download an issued invoice as Excel, in the exact reference layout (INVOICE + VIN DETAILS).
import { db } from "@/server/db";
import { invoiceXlsx } from "@/server/services/invoice";
import { requireUser } from "@/server/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const exists = await db.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!exists) return new Response("Not found", { status: 404 });
  if (exists.status === "DRAFT") return new Response("Issue the invoice before downloading it", { status: 409 });
  const { buffer, filename } = await invoiceXlsx(db, id);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
