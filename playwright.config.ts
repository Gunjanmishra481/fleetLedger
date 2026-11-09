import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Login credentials for the tests come from the git-ignored .env file.
if (existsSync(".env")) process.loadEnvFile(".env");

// Responsive check (docs/DESIGN.md). Runs the production build against prisma/e2e.db,
// a copy of dev.db made by tests/e2e/setup.ts, so saves never touch your data.
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
    env: { DATABASE_URL: "file:./e2e.db" },
  },
});
