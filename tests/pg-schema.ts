// Throwaway Postgres schemas for tests: each run gets a brand-new schema inside the Neon dev
// branch, built with the real migrations, and drops only that schema afterwards.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

export function loadEnv() {
  if (existsSync(".env")) process.loadEnvFile(".env");
}

/** Direct (non-pooled) dev-branch URL pointed at the given schema. */
export function schemaUrl(schema: string): string {
  const base = process.env.DIRECT_URL;
  if (!base?.startsWith("postgres")) throw new Error("DIRECT_URL (Neon dev branch) must be set in .env to run tests");
  const u = new URL(base);
  if (u.hostname.includes("-pooler")) throw new Error("DIRECT_URL must be the direct (non-pooled) connection");
  u.searchParams.set("schema", schema);
  return u.toString();
}

export function newSchemaName(prefix: string) {
  return `${prefix}_${Date.now()}_${process.pid}`;
}

/** Applies prisma/migrations to a new, empty schema. */
export function migrate(url: string) {
  execSync("pnpm prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
}

/** Drops a schema this test run created (names are always test_/e2e_ prefixed). */
export async function dropSchema(url: string) {
  const schema = new URL(url).searchParams.get("schema") ?? "";
  if (!/^(test|e2e)_\d+_\d+$/.test(schema)) throw new Error(`Refusing to drop unexpected schema "${schema}"`);
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await db.$disconnect();
  }
}
