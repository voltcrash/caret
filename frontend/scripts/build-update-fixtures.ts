import { spawnSync } from "node:child_process";
import { cp, readdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { preserveAssets, type PreviousAssets } from "./preserve-assets";

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "..");
  let previous: PreviousAssets = new Map();
  for (const build of ["update-a", "update-b"]) {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CARET_BUILD_ID: build,
      TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      AUTH_PROVIDERS: "github",
      SENTRY_DSN: "",
    };
    delete env["CARET_DEPLOY_ENV"];
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
    const client = resolve(target, "client");
    await preserveAssets(client, previous);
    previous = new Map(
      await Promise.all(
        (await readdir(resolve(client, "assets")))
          .filter((name) => /\.(?:js|css|woff2|wasm)$/.test(name))
          .map(async (name): Promise<[string, Uint8Array]> => [
            `/assets/${name}`,
            new Uint8Array(await readFile(resolve(client, "assets", name))),
          ]),
      ),
    );
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
