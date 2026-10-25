import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

const repoRoot = resolve(__dirname, "../../..");
// Absolute so tests can hide `vp` from the script's PATH.
const vpx = spawnSync("sh", ["-c", "command -v vpx"], {
  encoding: "utf8",
}).stdout.trim();

type Build = {
  target: string;
  args: string[];
  backendUrl?: string;
  siteKey?: string;
  providers?: string;
  authSecret?: string;
  turnstileSecret?: string;
};

describe("production build command", () => {
  let root: string;

  function write(path: string, contents: string): void {
    writeFileSync(resolve(root, path), contents);
  }

  function run(env: NodeJS.ProcessEnv = {}): SpawnSyncReturns<string> {
    return spawnSync(
      vpx,
      [resolve(root, "frontend/scripts/build-production-site.ts")],
      {
        // The script must locate its workspace independently of the caller.
        cwd: tmpdir(),
        env: {
          ...process.env,
          CI: "true",
          OXYTYPE_BUILD_ID: "fixture-build",
          ...env,
        },
        encoding: "utf8",
        timeout: 30_000,
      },
    );
  }

  function builds(): Build[] {
    const path = resolve(root, "builds.jsonl");
    if (!existsSync(path)) return [];
    return readFileSync(path, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Build);
  }

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), "oxytype-production-build-"));
    mkdirSync(resolve(root, "frontend/scripts"), { recursive: true });
    mkdirSync(resolve(root, "frontend/vite-plugins"));
    mkdirSync(resolve(root, "node_modules/.bin"), { recursive: true });
    symlinkSync(
      resolve(repoRoot, "node_modules/.bin/vp"),
      resolve(root, "node_modules/.bin/vp"),
    );
    symlinkSync(
      resolve(repoRoot, "node_modules/vite-plus"),
      resolve(root, "node_modules/vite-plus"),
      "dir",
    );
    symlinkSync(
      resolve(repoRoot, "frontend/node_modules"),
      resolve(root, "frontend/node_modules"),
      "dir",
    );
    for (const name of [
      "build-production-site.ts",
      "production-inputs.ts",
      "production-artifact.ts",
    ]) {
      copyFileSync(
        resolve(repoRoot, "frontend/scripts", name),
        resolve(root, "frontend/scripts", name),
      );
    }
    // Asset capture has its own HTTP/integrity suite; these subprocess tests
    // exercise compiler invocation and public/private build settings offline.
    write(
      "frontend/scripts/preserve-assets.ts",
      "export async function snapshotAssets(){return new Map();} export async function preserveAssets(){}\n",
    );
    for (const name of ["build-id.ts", "client-version.ts"]) {
      copyFileSync(
        resolve(repoRoot, "frontend/vite-plugins", name),
        resolve(root, "frontend/vite-plugins", name),
      );
    }
    copyFileSync(
      resolve(repoRoot, "frontend/wrangler.production.json"),
      resolve(root, "frontend/wrangler.production.json"),
    );
    write("pnpm-workspace.yaml", "packages:\n  - frontend\n  - backend\n");
    write(
      "package.json",
      JSON.stringify({
        name: "production-build-fixture",
        private: true,
        scripts: {
          "build-fe": "vp run --filter @oxytype/frontend build",
        },
      }),
    );
    // Enable caching to ensure the production command explicitly bypasses it.
    write("vite.config.mjs", "export default { run: { cache: true } };\n");
    for (const target of ["frontend"]) {
      write(
        `${target}/package.json`,
        JSON.stringify({
          name: `@oxytype/${target}`,
          private: true,
          scripts: { "build:start": `node ../fixture-build.mjs ${target}` },
        }),
      );
    }
    write(
      "frontend/.dev.vars.production",
      "BETTER_AUTH_SECRET=production-auth-secret-fixture-32-characters\n" +
        "TURNSTILE_SECRET_KEY=production-turnstile-secret-fixture\n" +
        "GITHUB_CLIENT_ID=production-client-id\n" +
        "GITHUB_CLIENT_SECRET=production-client-secret-fixture\n",
    );
    write(
      "frontend/.env.production.local",
      "BACKEND_URL=/api\nTURNSTILE_SITE_KEY=0xproduction-fixture\nAUTH_PROVIDERS=github\n",
    );
    write(
      "fixture-build.mjs",
      `import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
const target = process.argv[2];
const args = process.argv.slice(3);
if (args.length > 0) throw new Error('Unexpected build arguments: ' + args.join(' '));
appendFileSync(new URL('./builds.jsonl', import.meta.url), JSON.stringify({
  target, args,
  backendUrl: process.env.BACKEND_URL,
  siteKey: process.env.TURNSTILE_SITE_KEY,
  providers: process.env.AUTH_PROVIDERS,
  authSecret: process.env.BETTER_AUTH_SECRET,
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY,
}) + '\\n');
if (process.env.FIXTURE_FAIL_BUILD === target) process.exit(1);
mkdirSync(new URL("./frontend/dist/start/server", import.meta.url), { recursive: true });
writeFileSync(new URL("./frontend/dist/start/server/index.js", import.meta.url), "export default {};");
`,
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("builds one Start artifact through the real CLI without forwarding runner flags", () => {
    const result = run();
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(builds().map(({ target, args }) => ({ target, args }))).toEqual([
      { target: "frontend", args: [] },
    ]);
  }, 30_000);

  it("bypasses enabled task caches on repeated production builds", () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = run();
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(result.stdout.match(/cache disabled/g)).toHaveLength(1);
    }
    expect(builds().map(({ target }) => target)).toEqual([
      "frontend",
      "frontend",
    ]);
  }, 30_000);

  it("uses production public settings over inherited staging settings without copying backend secrets", () => {
    const result = run({
      BACKEND_URL: "https://staging.example.test/api",
      TURNSTILE_SITE_KEY: "staging-site-key",
      AUTH_PROVIDERS: "google",
      BETTER_AUTH_SECRET: undefined,
      TURNSTILE_SECRET_KEY: undefined,
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    for (const build of builds()) {
      expect(build).toMatchObject({
        backendUrl: "/api",
        siteKey: "0xproduction-fixture",
        providers: "github",
      });
      expect(build.authSecret).toBeUndefined();
      expect(build.turnstileSecret).toBeUndefined();
    }
  }, 30_000);

  it.each([["frontend", "build:start", ["frontend"]]])(
    "stops and reports a failed %s build",
    (target, script, expected) => {
      const result = run({ FIXTURE_FAIL_BUILD: target });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `${script} failed; production was not deployed`,
      );
      expect(builds().map(({ target: built }) => built)).toEqual(expected);
    },
    30_000,
  );

  it("fails closed when vp cannot start", () => {
    const result = run({ PATH: root });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "build:start failed; production was not deployed",
    );
    expect(builds()).toEqual([]);
  }, 30_000);

  it.each([
    "frontend/.dev.vars.production",
    "frontend/.env.production.local",
    "frontend/wrangler.production.json",
  ])(
    "rejects a missing %s before starting builds",
    (path) => {
      rmSync(resolve(root, path));
      const result = run();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("ENOENT");
      expect(builds()).toEqual([]);
    },
    30_000,
  );

  it.each([
    [
      "frontend/.dev.vars.production",
      "BETTER_AUTH_SECRET=replace-with-production-secret\n",
      "BETTER_AUTH_SECRET",
    ],
    [
      "frontend/.env.production.local",
      "BACKEND_URL=/api\nTURNSTILE_SITE_KEY=replace-with-site-key\nAUTH_PROVIDERS=github\n",
      "real production TURNSTILE_SITE_KEY",
    ],
  ])(
    "rejects invalid %s before starting builds",
    (path, settings, message) => {
      write(path, settings);
      const result = run();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(message);
      expect(builds()).toEqual([]);
    },
    30_000,
  );
});
