import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { resolveBuildId } from "../vite-plugins/build-id";
import { writeArtifact } from "./production-artifact";
import { preserveAssets, snapshotAssets } from "./preserve-assets";

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "..");
  const settings = parseEnv(
    await readFile(resolve(root, ".env.staging.local"), "utf8"),
  );
  if (
    settings["BACKEND_URL"] !== "/api" ||
    (settings["TURNSTILE_SITE_KEY"] ?? "") === "" ||
    (settings["AUTH_PROVIDERS"] ?? "") === ""
  ) {
    throw new Error(
      "Configure staging public settings in frontend/.env.staging.local",
    );
  }
  const buildId = resolveBuildId(false);
  const previous = await snapshotAssets(
    "https://oxytype-api-staging.voltcrash.workers.dev",
  );
  const result = spawnSync("vp", ["run", "--no-cache", "build:start:staging"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      ...settings,
      SENTRY_DSN: settings["SENTRY_DSN"] ?? "",
      OXYTYPE_BUILD_ID: buildId,
    },
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error("Staging build failed; staging was not deployed");
  }
  await preserveAssets(resolve(root, "dist/start/client"), previous);
  await writeArtifact(resolve(root, "dist/start"), {
    buildId,
    siteKey: settings["TURNSTILE_SITE_KEY"] as string,
    providers: settings["AUTH_PROVIDERS"] as string,
  });
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Staging build failed",
  );
  process.exitCode = 1;
});
