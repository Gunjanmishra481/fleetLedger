import { defineConfig } from "@playwright/test";
import { loadEnv, newSchemaName, schemaUrl } from "./tests/pg-schema";

// Responsive check (docs/DESIGN.md). Runs the production build against a brand-new Postgres
// schema in the Neon dev branch, seeded with September by tests/e2e/setup.ts and dropped after,
// so saves and merges never touch your data. Login credentials come from the git-ignored .env.
loadEnv();
const url = process.env.E2E_DATABASE_URL ?? schemaUrl(newSchemaName("e2e"));
process.env.E2E_DATABASE_URL = url; // the config is evaluated in several processes; keep one schema
const PORT = 3210;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  webServer: {
    command: `pnpm next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: url, DIRECT_URL: url },
  },
});
