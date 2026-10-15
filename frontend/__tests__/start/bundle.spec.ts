import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve(import.meta.dirname, "../../dist/start");

function read(dir: string): string {
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
  "withRuntime",
  "consumeBatch",
];
// Legacy browser bootstrap literals; Start must never mount it.
const legacyMarkers = ["App mount not found", "toggleSmoothedBurst"];

describe("built Start bundle boundaries", () => {
  const client = read("client/assets");
  const server = read("server");

  it("markers are meaningful in the server bundle", () => {
    for (const marker of serverMarkers) expect(server).toContain(marker);
  });

  it("keeps application server code out of browser JS", () => {
    for (const marker of serverMarkers) expect(client).not.toContain(marker);
  });

  it("never bundles the legacy browser bootstrap", () => {
    for (const marker of legacyMarkers) {
      expect(client).not.toContain(marker);
      expect(server).not.toContain(marker);
    }
  });

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
