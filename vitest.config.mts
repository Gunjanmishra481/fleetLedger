import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { loadEnv, newSchemaName, schemaUrl } from "./tests/pg-schema";

// Each run gets its own new Postgres schema in the Neon dev branch (dropped afterwards),
// so tests never touch dev or production data.
loadEnv();
const url = schemaUrl(newSchemaName("test"));
process.env.TEST_DATABASE_URL = url;

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
    fileParallelism: false, // test files share one schema
    testTimeout: 30_000,
    hookTimeout: 180_000,
    globalSetup: ["tests/setup-db.ts"],
    env: { DATABASE_URL: url, DIRECT_URL: url },
  },
});
