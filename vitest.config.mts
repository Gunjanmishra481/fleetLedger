import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

// Each run gets its own brand-new SQLite file, so tests never reset or touch dev.db.
const testDb = path.join(tmpdir(), `fleetledger-test-${Date.now()}-${process.pid}.db`).replace(/\\/g, "/");
process.env.TEST_DATABASE_URL = `file:${testDb}`;

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
    fileParallelism: false, // test files share one temp database
    globalSetup: ["tests/setup-db.ts"],
    env: { DATABASE_URL: `file:${testDb}` },
  },
});
