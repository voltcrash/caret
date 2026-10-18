import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { validateArtifact } from "./production-artifact";

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "..");
  const config: unknown = JSON.parse(
    await readFile(resolve(root, "wrangler.staging.json"), "utf8"),
  );
  const settings = parseEnv(
    await readFile(resolve(root, ".env.staging.local"), "utf8"),
  );
  await validateArtifact(resolve(root, "dist/start"), {
    config,
    siteKey: settings["TURNSTILE_SITE_KEY"] ?? "",
    providers: settings["AUTH_PROVIDERS"] ?? "",
  });
  console.log("Matched staging artifact checked");
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Staging checks failed",
  );
  process.exitCode = 1;
});
