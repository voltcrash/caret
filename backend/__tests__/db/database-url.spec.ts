import { afterEach, expect, it, vi } from "vite-plus/test";
import { databaseUrl } from "../../scripts/database-url";

afterEach(() => vi.unstubAllEnvs());
it("accepts the deployment environment forwarded through vp run", async () => {
  const url =
    "postgresql://user:fixture@ep-fixture.neon.tech/neondb?sslmode=require";
  vi.stubEnv("DATABASE_URL", url);
  const previous = process.argv;
  try {
    process.argv = ["node", "migrate.ts", "--", "production"];
    expect(await databaseUrl()).toBe(url);
  } finally {
    process.argv = previous;
  }
});
it.each([
  "postgresql://user:fixture@localhost/test?sslmode=require",
  "postgresql://user:fixture@ep-fixture.neon.tech/test?sslmode=disable",
])("rejects non-Neon or insecure URLs", async (url) => {
  vi.stubEnv("DATABASE_URL", url);
  await expect(databaseUrl("production")).rejects.toThrow(
    "Neon PostgreSQL with sslmode=require",
  );
});
