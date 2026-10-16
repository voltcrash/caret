import { spawnSync } from "node:child_process";
import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "..");
  for (const build of ["update-a", "update-b"]) {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      OXYTYPE_BUILD_ID: build,
      TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      AUTH_PROVIDERS: "github",
      SENTRY_DSN: "",
    };
    delete env["OXYTYPE_DEPLOY_ENV"];
    const result = spawnSync("vp", ["run", "--no-cache", "build:start"], {
      cwd: root,
      env,
      stdio: "inherit",
    });
    if (result.error !== undefined || result.status !== 0) {
      throw new Error(`Failed ${build} fixture build`);
    }
    const target = resolve(root, "dist", build);
    await rm(target, { recursive: true, force: true });
    await cp(resolve(root, "dist/start"), target, { recursive: true });
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
