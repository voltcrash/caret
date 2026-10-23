import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "packages/typing-engine/generated");
const cacheFile = resolve(output, "build-cache.json");
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? files(path) : [path];
    })
    .sort();
}
function digest(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function fingerprint(): string {
  const sources = [
    "Cargo.toml",
    "Cargo.lock",
    "rust-toolchain.toml",
    "package.json",
    "scripts/engine.ts",
  ].map((path) => resolve(root, path));
  for (const path of ["crates", ".cargo"]) {
    const directory = resolve(root, path);
    if (existsSync(directory)) sources.push(...files(directory));
  }
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        key.startsWith("RUST") ||
        key.startsWith("CARGO_PROFILE_") ||
        key.startsWith("CARGO_BUILD_") ||
        key === "CARGO_ENCODED_RUSTFLAGS",
    ),
  );
  return createHash("sha256")
    .update(
      JSON.stringify({
        sources: sources
          .sort()
          .map((path) => [relative(root, path), digest(path)]),
        environment,
        platform: process.platform,
        architecture: process.arch,
      }),
    )
    .digest("hex");
}
type BuildCache = { fingerprint: string; outputs: [string, string][] };
function cached(key: string): boolean {
  try {
    const cache = JSON.parse(readFileSync(cacheFile, "utf8")) as BuildCache;
    return (
      cache.fingerprint === key &&
      cache.outputs.length > 0 &&
      cache.outputs.every(
        ([path, hash]) => digest(resolve(output, path)) === hash,
      )
    );
  } catch {
    return false;
  }
}
function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

switch (process.argv[2]) {
  case "build": {
    const key = fingerprint();
    if (!process.argv.includes("--force") && cached(key)) {
      process.stdout.write(
        "Typing engine bindings verified; build cache hit\n",
      );
      break;
    }
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
      "--profile",
      "wasm",
      "--target-dir",
      resolve(root, "target"),
      "--target",
      "wasm32-unknown-unknown",
      "-p",
      "typing-engine-wasm",
    ]);
    const staging = mkdtempSync(
      resolve(root, "target/typing-engine-bindings-"),
    );
    run("wasm-bindgen", [
      "--target",
      "web",
      "--out-dir",
      staging,
      "--out-name",
      "engine",
      resolve(
        root,
        "target/wasm32-unknown-unknown/wasm/typing_engine_wasm.wasm",
      ),
    ]);
    const binaryen = dirname(
      createRequire(import.meta.url).resolve("binaryen/package.json"),
    );
    const wasm = resolve(staging, "engine_bg.wasm");
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
      "--",
      resolve(staging, "types"),
    ]);
    // Keep the prior declarations available throughout compilation/optimization.
    // Publish only complete files, then remove obsolete generated output.
    const produced = new Set(
      files(staging).map((path) => relative(staging, path)),
    );
    for (const path of produced) {
      const destination = resolve(output, path);
      mkdirSync(dirname(destination), { recursive: true });
      renameSync(resolve(staging, path), destination);
    }
    for (const path of files(output)) {
      if (path !== cacheFile && !produced.has(relative(output, path))) {
        rmSync(path);
      }
    }
    rmSync(staging, { recursive: true, force: true });
    const cache: BuildCache = {
      fingerprint: key,
      outputs: files(output)
        .filter(
          (path) =>
            path !== cacheFile && !path.includes("build-cache.json.tmp-"),
        )
        .map((path) => [relative(output, path), digest(path)]),
    };
    const temporary = `${cacheFile}.tmp-${process.pid}`;
    writeFileSync(temporary, JSON.stringify(cache));
    renameSync(temporary, cacheFile);
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
