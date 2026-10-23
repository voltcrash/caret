import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** Every Vite entry (dev, Start, staging, production) bootstraps ignored bindings. */
export function prepareTypingEngine(): void {
  const root = resolve(import.meta.dirname, "../..");
  execFileSync(
    process.execPath,
    [resolve(root, "scripts/engine.ts"), "build"],
    {
      cwd: root,
      // Vite also loads this config for machine-readable commands such as
      // lint --print-config. Build diagnostics must never contaminate stdout.
      stdio: ["ignore", 2, 2],
    },
  );
}
