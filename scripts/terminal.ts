import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const command = process.argv[2];
const args = process.argv.slice(3);
if (command === "tools-test") {
  const result = spawnSync(
    "python3",
    ["-m", "unittest", "scripts/terminal_release_test.py"],
    { cwd: resolve(import.meta.dirname, ".."), stdio: "inherit" },
  );
  if (result.error !== undefined) throw result.error;
  process.exit(result.status ?? 1);
}
if (
  command !== undefined &&
  ["package", "source", "archive-smoke", "release-gate"].includes(command)
) {
  const result = spawnSync(
    "python3",
    [
      "scripts/terminal_release.py",
      command,
      ...args.filter((arg) => arg !== "--"),
    ],
    { cwd: resolve(import.meta.dirname, ".."), stdio: "inherit" },
  );
  if (result.error !== undefined) throw result.error;
  process.exit(result.status ?? 1);
}
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
