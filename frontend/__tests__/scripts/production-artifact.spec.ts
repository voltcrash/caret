import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import {
  validateArtifact,
  writeArtifact,
} from "../../scripts/production-artifact";

let directory: string;
let config: Record<string, unknown>;
const settings = {
  buildId: "build-a",
  siteKey: "production-public-key",
  providers: "github",
};
beforeEach(async () => {
  directory = await mkdtemp(resolve(tmpdir(), "oxytype-artifact-"));
  config = JSON.parse(
    await readFile(
      resolve(import.meta.dirname, "../../wrangler.production.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
  await mkdir(resolve(directory, "server"));
  await mkdir(resolve(directory, "client"));
  await writeFile(
    resolve(directory, "server/wrangler.json"),
    JSON.stringify({
      ...config,
      vars: { ...(config["vars"] as object), VERSION: settings.buildId },
    }),
  );
  await writeFile(resolve(directory, "server/index.js"), "export default {};");
  await writeFile(
    resolve(directory, "client/version.json"),
    JSON.stringify({ version: settings.buildId }),
  );
  await writeFile(
    resolve(directory, "client/index.js"),
    "console.log('build-a');",
  );
  await writeArtifact(directory, settings);
});
afterEach(async () => await rm(directory, { recursive: true, force: true }));

it("validates one matching release without including private preview credentials", async () => {
  await writeFile(
    resolve(directory, "server/.dev.vars"),
    "BETTER_AUTH_SECRET=private",
  );
  await writeArtifact(directory, settings);
  await expect(
    readFile(resolve(directory, "server/.dev.vars")),
  ).rejects.toThrow();
  await expect(
    validateArtifact(directory, { ...settings, config }),
  ).resolves.toBeUndefined();
  expect(
    await readFile(resolve(directory, "artifact.json"), "utf8"),
  ).not.toContain("private");
});

it.each(["server/index.js", "client/index.js", "client/version.json"])(
  "rejects changed %s after a build",
  async (path) => {
    await writeFile(resolve(directory, path), "different build");
    await expect(
      validateArtifact(directory, { ...settings, config }),
    ).rejects.toThrow("artifact changed");
  },
);

it("rejects added assets and changed public deployment settings", async () => {
  await expect(
    validateArtifact(directory, {
      ...settings,
      siteKey: "staging-key",
      config,
    }),
  ).rejects.toThrow("different public settings");
  await writeFile(resolve(directory, "client/unmatched.js"), "stale chunk");
  await expect(
    validateArtifact(directory, { ...settings, config }),
  ).rejects.toThrow("artifact changed");
});

it("rejects a sealed artifact for a different Worker or release", async () => {
  await expect(
    validateArtifact(directory, {
      ...settings,
      config: { ...config, name: "staging" },
    }),
  ).rejects.toThrow("different name");
  await writeFile(
    resolve(directory, "client/version.json"),
    JSON.stringify({ version: "build-b" }),
  );
  await writeArtifact(directory, settings);
  await expect(
    validateArtifact(directory, { ...settings, config }),
  ).rejects.toThrow("one release");
});
