import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "packages/typing-engine/generated");
function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

switch (process.argv[2]) {
  case "build": {
    const bindingVersion = "0.2.129";
    const installed = spawnSync("wasm-bindgen", ["--version"], {
      encoding: "utf8",
    });
    if (installed.stdout?.trim() !== `wasm-bindgen ${bindingVersion}`) {
      run("cargo", [
        "install",
        "wasm-bindgen-cli",
        "--version",
        bindingVersion,
        "--locked",
      ]);
    }
    run("cargo", [
      "build",
      "--locked",
      "--release",
      "--target",
      "wasm32-unknown-unknown",
      "-p",
      "typing-engine-wasm",
    ]);
    mkdirSync(output, { recursive: true });
    run("wasm-bindgen", [
      "--target",
      "web",
      "--out-dir",
      output,
      "--out-name",
      "engine",
      resolve(
        root,
        "target/wasm32-unknown-unknown/release/typing_engine_wasm.wasm",
      ),
    ]);
    const binaryen = dirname(
      createRequire(import.meta.url).resolve("binaryen/package.json"),
    );
    const wasm = resolve(output, "engine_bg.wasm");
    run(process.execPath, [
      resolve(binaryen, "bin/wasm-opt"),
      wasm,
      "-Oz",
      "--enable-bulk-memory",
      "--enable-nontrapping-float-to-int",
      "--enable-sign-ext",
      "--enable-multivalue",
      "--enable-reference-types",
      "-o",
      wasm,
    ]);
    run("cargo", [
      "run",
      "--locked",
      "--quiet",
      "-p",
      "typing-engine",
      "--bin",
      "export-bindings",
    ]);
    break;
  }
  case "test":
    run("cargo", ["test", "--locked", "--workspace"]);
    break;
  case "lint":
    run("cargo", [
      "clippy",
      "--locked",
      "--workspace",
      "--all-targets",
      "--",
      "-D",
      "warnings",
    ]);
    break;
  case "fmt":
    run("cargo", ["fmt", "--all", "--check"]);
    break;
  case "fmt-fix":
    run("cargo", ["fmt", "--all"]);
    break;
  default:
    throw new Error(
      "Usage: vp run engine:build|engine:test|engine:lint|engine:fmt|engine:fmt-fix",
    );
}
