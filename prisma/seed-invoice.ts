// Seeds the JKTI client (Bill To) by reading the reference invoice
// (tests/fixtures/invoices/JKTI_INV_108.xlsx). Only fills what is missing: edits made in
// Masters are never overwritten. Safe to re-run. Mahakal's own details live in src/config/company.ts;
// the invoice number series is seeded by migration 0004.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { readReferenceInvoice } from "../src/server/invoice/reference";

const db = new PrismaClient();

/** "JKTI (CE)" -> "JKTI" */
function shortName(label: string | null, billingName: string) {
  return (label?.split(/[\s(]/)[0] || billingName.split(/\s+/).slice(0, 2).join(" ")).toUpperCase();
}

export async function seedInvoicing(prisma: PrismaClient, file: string) {
  const ref = await readReferenceInvoice(await readFile(file));
  const b = ref.buyer;
  const name = shortName(b.handlingLabel, b.billingName);
  const client = await prisma.consignor.upsert({
    where: { name },
    create: {
      name,
      billingName: b.billingName,
      addressLines: b.addressLines,
      gstin: b.gstin,
      pan: b.pan,
      state: b.state,
      stateCode: b.stateCode,
      handlingLabel: b.handlingLabel,
    },
    update: {},
  });

  // Loading points named after the client ("JKTI (CHHARODI)") bill to it, unless already assigned.
  const linked = await prisma.location.updateMany({
    where: { kind: "LOADING_POINT", consignorId: null, name: { startsWith: name } },
    data: { consignorId: client.id },
  });

  // Carrier model/type from the invoice lines, for trailers that don't have one yet.
  let models = 0;
  for (const l of ref.lines) {
    if (!l.model) continue;
    models += (await prisma.vehicle.updateMany({ where: { regNo: l.carrierNo, model: null }, data: { model: l.model } })).count;
  }

  return { client: client.name, loadingPointsLinked: linked.count, trailerModelsSet: models };
}

if (require.main === module) {
  seedInvoicing(db, path.resolve(__dirname, "../tests/fixtures/invoices/JKTI_INV_108.xlsx"))
    .then((r) => console.log("Invoicing seed:", JSON.stringify(r)))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
