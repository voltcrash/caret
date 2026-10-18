import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { validateProductionInputs } from "./production-inputs";
import { validateArtifact } from "./production-artifact";

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "..");
  const backend = parseEnv(
    await readFile(resolve(root, ".dev.vars.production"), "utf8"),
  );
  const frontend = parseEnv(
    await readFile(resolve(root, ".env.production.local"), "utf8"),
  );
  const config: unknown = JSON.parse(
    await readFile(resolve(root, "wrangler.production.json"), "utf8"),
  );
  let staging: NodeJS.Dict<string> | undefined;
  try {
    staging = parseEnv(
      await readFile(resolve(root, ".dev.vars.staging"), "utf8"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  validateProductionInputs({ config, backend, frontend, staging });
  await validateArtifact(resolve(root, "dist/start"), {
    siteKey: frontend["TURNSTILE_SITE_KEY"] as string,
    providers: frontend["AUTH_PROVIDERS"] as string,
    config,
  });
  console.log(
    "Production configuration, credentials and frontend build checked",
  );
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Production checks failed",
  );
  process.exitCode = 1;
});
