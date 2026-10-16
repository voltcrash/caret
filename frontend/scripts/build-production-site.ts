import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { validateProductionInputs } from "./production-inputs";
import { writeArtifact } from "./production-artifact";
import { resolveBuildId } from "../vite-plugins/build-id";
import { preserveAssets, snapshotAssets } from "./preserve-assets";

async function main(): Promise<void> {
  const frontendRoot = resolve(import.meta.dirname, "..");
  const frontend = parseEnv(
    await readFile(resolve(frontendRoot, ".env.production.local"), "utf8"),
  );
  const backend = parseEnv(
    await readFile(resolve(frontendRoot, ".dev.vars.production"), "utf8"),
  );
  const config: unknown = JSON.parse(
    await readFile(resolve(frontendRoot, "wrangler.production.json"), "utf8"),
  );
  validateProductionInputs({ config, backend, frontend });
  const origin = (config as { vars: { FRONTEND_URL: string } }).vars
    .FRONTEND_URL;
  const previous = await snapshotAssets(origin);

  // Only public build settings are forwarded; backend secrets stay in their file.
  const env = {
    ...process.env,
    BACKEND_URL: frontend["BACKEND_URL"],
    TURNSTILE_SITE_KEY: frontend["TURNSTILE_SITE_KEY"],
    AUTH_PROVIDERS: frontend["AUTH_PROVIDERS"],
    SENTRY_DSN: frontend["SENTRY_DSN"] ?? "",
    OXYTYPE_DEPLOY_ENV: "production",
    OXYTYPE_BUILD_ID: resolveBuildId(false),
  };
  // One compiler invocation owns the matching server and client; never a cached
  // frontend followed by an independently built backend.
  const result = spawnSync("vp", ["run", "--no-cache", "build:start"], {
    cwd: frontendRoot,
    env,
    stdio: "inherit",
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error("build:start failed; production was not deployed");
  }
  await preserveAssets(resolve(frontendRoot, "dist/start/client"), previous);
  await writeArtifact(resolve(frontendRoot, "dist/start"), {
    buildId: env.OXYTYPE_BUILD_ID,
    siteKey: frontend["TURNSTILE_SITE_KEY"] as string,
    providers: frontend["AUTH_PROVIDERS"] as string,
  });
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Production build failed",
  );
  process.exitCode = 1;
});
