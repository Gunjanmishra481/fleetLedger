// Vitest global setup: create the schema in this run's new, empty temp database
// (path chosen in vitest.config.mts). No reset is needed because the file is new.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL not set by vitest.config.mts");
  execSync("pnpm prisma db push --skip-generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
  // Teardown: remove this run's own temp file.
  return () => {
    const file = url.replace(/^file:/, "");
    for (const f of [file, `${file}-journal`]) rmSync(f, { force: true });
  };
}
