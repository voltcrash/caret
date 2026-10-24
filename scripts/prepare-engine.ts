import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** Synchronous bootstrap; the builder verifies cached outputs before reuse. */
export function prepareTypingEngine(): void {
  const root = resolve(import.meta.dirname, "..");
  execFileSync(
    process.execPath,
    [resolve(root, "scripts/engine.ts"), "build"],
    {
      cwd: root,
      // Lint --print-config and other callers reserve stdout for structured output.
      stdio: ["ignore", 2, 2],
    },
  );
}
