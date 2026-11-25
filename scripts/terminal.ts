import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { runReleaseCommand } from "./terminal-release.ts";

const root = resolve(import.meta.dirname, "..");
const command = process.argv[2];
const args = process.argv.slice(3);
// vp forwards its separator; strip only that first token, preserving values.
if (args[0] === "--") args.shift();

function runOrExit(cmd: string, cmdArgs: string[]): void {
  const result = spawnSync(cmd, cmdArgs, { cwd: root, stdio: "inherit" });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (command === "tools-test") {
  runOrExit("cargo", [
    "test",
    "--locked",
    "-p",
    "caret-tui",
    "--example",
    "terminal-harness",
  ]);
  runOrExit(process.execPath, ["--test", "scripts/terminal-release.test.ts"]);
  process.exit(0);
}

if (
  command !== undefined &&
  ["package", "source", "archive-smoke", "release-gate", "checksums"].includes(
    command,
  )
) {
  try {
    runReleaseCommand(command, args);
    process.exit(0);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}

const tasks: Record<string, string[]> = {
  dev: ["run", "--locked", "-p", "caret-tui", "--", ...args],
  build: ["build", "--locked", "--release", "-p", "caret-tui", ...args],
  test: ["test", "--locked", "-p", "caret-tui", ...args],
  pty: [
    "build",
    "--locked",
    "-p",
    "caret-tui",
    "--bin",
    "caret",
    "--example",
    "terminal-harness",
  ],
  emulator: [
    "build",
    "--locked",
    "-p",
    "caret-tui",
    "--bin",
    "caret",
    "--example",
    "terminal-harness",
  ],
};
if (command === undefined || tasks[command] === undefined) {
  throw new Error(
    "Usage: vp run terminal:dev|terminal:build|terminal:test|terminal:test:emulator",
  );
}
runOrExit("cargo", tasks[command]);
if (command === "pty" || command === "emulator") {
  const harness = resolve(root, "target/debug/examples/terminal-harness");
  runOrExit(
    harness,
    command === "pty" ? ["pty", "target/debug/caret"] : ["emulator", ...args],
  );
}
