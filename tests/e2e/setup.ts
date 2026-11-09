// Fresh copy of the seeded dev database for the browser tests (copy, never reset).
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

export default function setup() {
  const src = path.resolve(__dirname, "../../prisma/dev.db");
  if (!existsSync(src)) throw new Error("prisma/dev.db not found. Run `pnpm db:seed` first.");
  copyFileSync(src, path.resolve(__dirname, "../../prisma/e2e.db"));
}
