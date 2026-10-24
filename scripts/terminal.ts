import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const command = process.argv[2];
const args = process.argv.slice(3);
const tasks: Record<string, string[]> = {
  dev: ["run", "--locked", "-p", "oxytype-tui", "--", ...args],
  build: ["build", "--locked", "--release", "-p", "oxytype-tui", ...args],
  test: ["test", "--locked", "-p", "oxytype-tui", ...args],
  pty: ["build", "--locked", "-p", "oxytype-tui"],
};
if (command === undefined || tasks[command] === undefined) {
  throw new Error("Usage: vp run terminal:dev|terminal:build|terminal:test");
}
const result = spawnSync("cargo", tasks[command], {
  cwd: resolve(import.meta.dirname, ".."),
  stdio: "inherit",
});
if (result.error !== undefined) throw result.error;
if (command === "pty" && result.status === 0) {
  const check = spawnSync(
    "python3",
    ["scripts/terminal_pty.py", "target/debug/oxytype"],
    {
      cwd: resolve(import.meta.dirname, ".."),
      stdio: "inherit",
    },
  );
  if (check.error !== undefined) throw check.error;
  process.exit(check.status ?? 1);
}
process.exit(result.status ?? 1);
