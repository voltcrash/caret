import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Start's internal loadEnv(..., "") fingerprints the task runner's entire
// environment. Sanitize before starting vp run, so run IDs and credentials
// never become build inputs. This entry is only for CI fixture builds.
const keys = [
  "PATH",
  "HOME",
  "SHELL",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "TZ",
  "CI",
  "NODE_OPTIONS",
  "NODE_ENV",
  "CARET_BUILD_ID",
  "CARET_DEPLOY_ENV",
  "CARET_ENGINE_PROOF",
  "AUTH_PROVIDERS",
  "TURNSTILE_SITE_KEY",
  "SENTRY_DSN",
  "DEV_TOOLS",
  "DEV_PREFETCH",
] as const;
const env = Object.fromEntries(
  keys.flatMap((key) =>
    process.env[key] === undefined ? [] : [[key, process.env[key]]],
  ),
);
const result = spawnSync(
  "vp",
  ["run", "ci:build:start", ...process.argv.slice(2)],
  {
    cwd: resolve(import.meta.dirname, "../.."),
    env,
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
