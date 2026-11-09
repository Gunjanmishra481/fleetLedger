// Vitest global setup: build this run's new schema from the migrations; drop it when done.
import { dropSchema, migrate } from "./pg-schema";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL not set by vitest.config.mts");
  migrate(url);
  return () => dropSchema(url);
}
