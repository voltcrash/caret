import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(dir: string, build = "start"): string {
  const dist = resolve(import.meta.dirname, `../../dist/${build}`);
  return readdirSync(resolve(dist, dir), { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(resolve(dist, dir, name), "utf8"))
    .join("\n");
}

// App server identifiers that survive minification (literals/exports).
// The supported Better Auth infra client imports core/env (getter names only);
// its generic BETTER_AUTH_SECRET string is not an application binding leak.
const serverMarkers = [
  "public_stats",
  "sqlite_master",
  "outbox",
  "rate_counters",
];
// Legacy bootstrap/page-lifecycle literals; Start must never mount them.
const legacyMarkers = [
  "App mount not found",
  "stoped, page already active",
  "Missing page ref",
];

describe("built Start bundle boundaries", () => {
  const client = read("client/assets");
  const server = read("server");

  it("markers are meaningful in the server bundle", () => {
    for (const marker of serverMarkers) {
      expect(server.includes(marker), marker).toBe(true);
    }
  });

  it("keeps application server code out of browser JS", () => {
    for (const marker of serverMarkers) {
      expect(client.includes(marker), marker).toBe(false);
    }
  });

  it("never bundles the legacy bootstrap, page controller or page cache", () => {
    for (const marker of legacyMarkers) {
      expect(client).not.toContain(marker);
      expect(server).not.toContain(marker);
    }
  });

  it("dispatches server routes without the Hono application", () => {
    // Hono's dispatch error survives minification; the old API entry emitted it.
    expect(server).not.toContain("Context is not finalized");
  });

  it.each(["start", "start-test"])(
    "never emits runtime require calls in %s",
    (build) => {
      expect(
        read("server", build).match(/__require\("[^"]+"\)/g) ?? [],
      ).toEqual([]);
    },
  );

  it("includes browser setup only in client chunks", () => {
    for (const marker of [
      "loading localStorage config",
      "Activating Sentry",
      "Debug logs automatically enabled on localhost",
    ]) {
      expect(client).toContain(marker);
      expect(server).not.toContain(marker);
    }
  });
});
