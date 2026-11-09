// Browser-test database: a new Postgres schema built from the migrations and seeded with
// September through the real importer; dropped when the run ends.
import { execSync } from "node:child_process";
import { dropSchema, migrate } from "../pg-schema";

export default function setup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL not set by playwright.config.ts");
  migrate(url);
  execSync("pnpm tsx prisma/seed.ts", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url } });
  return () => dropSchema(url);
}
