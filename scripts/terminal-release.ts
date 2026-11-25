/**
 * Native release tooling. No publication; platform workflow owns authorized tags.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "target/terminal-release");
export const TARGETS = [
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
] as const;

type ReleaseTarget = (typeof TARGETS)[number];

type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: Buffer;
  silentStdout?: boolean;
};

type CommandRunner = (
  args: readonly string[],
  options?: RunOptions,
) => { stdout: Buffer };

function run(
  args: readonly string[],
  options: RunOptions = {},
): { stdout: Buffer } {
  const [command, ...rest] = args;
  if (command === undefined) {
    throw new Error("Command cannot be empty");
  }
  const result = spawnSync(command, rest, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    input: options.input,
    stdio: [
      options.input !== undefined ? "pipe" : "inherit",
      options.silentStdout === true ? "ignore" : "pipe",
      "inherit",
    ],
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${String(result.status ?? 1)}: ${command}`,
    );
  }
  return { stdout: result.stdout ?? Buffer.alloc(0) };
}

function capture(args: readonly string[], options: RunOptions = {}): string {
  return run(args, options).stdout.toString("utf8");
}

function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function decodeStrictBase64(value: string): Buffer {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    throw new Error("Invalid base64 encoding");
  }
  return Buffer.from(value, "base64");
}

export function version(root: string = ROOT): string {
  const cargoToml = readFileSync(resolve(root, "Cargo.toml"), "utf8");
  let inWorkspacePackage = false;
  for (const rawLine of cargoToml.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (line.length === 0) continue;
    if (line.startsWith("[")) {
      inWorkspacePackage = line === "[workspace.package]";
      continue;
    }
    if (inWorkspacePackage) {
      const match = /^version\s*=\s*"([^"]+)"$/.exec(line);
      if (match?.[1] !== undefined) {
        return match[1];
      }
    }
  }
  throw new Error("Could not find [workspace.package].version in Cargo.toml");
}

export function checksum(filePath: string): string {
  const digest = sha256Hex(readFileSync(filePath));
  const checksumPath = `${filePath}.sha256`;
  writeFileSync(checksumPath, `${digest}  ${basename(filePath)}\n`, "utf8");
  return checksumPath;
}

export function archive(directory: string): string {
  const resolvedDir = resolve(directory);
  const parent = dirname(resolvedDir);
  const name = basename(resolvedDir);
  const output = resolve(parent, `${name}.tar.gz`);
  run(["tar", "-czf", output, "-C", parent, name], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  checksum(output);
  return output;
}

type CargoPackage = {
  name: string;
  version: string;
  source: string | null;
  manifest_path: string;
  license?: string | null;
  license_file?: string | null;
  repository?: string | null;
};

type LicenseOverride = {
  vcsRevision: string;
  license: string;
  file: string;
  sha256: string;
};

function licenses(
  directory: string,
  target: string,
  root: string = ROOT,
): void {
  const metadata = JSON.parse(
    capture(
      [
        "cargo",
        "metadata",
        "--locked",
        "--format-version",
        "1",
        "--filter-platform",
        target,
      ],
      { cwd: root },
    ),
  ) as { packages: CargoPackage[] };

  const overrideDir = resolve(root, "docs/rust-engine/third-party");
  const overrides = JSON.parse(
    readFileSync(resolve(overrideDir, "license-overrides.json"), "utf8"),
  ) as Record<string, LicenseOverride>;

  const sorted = [...metadata.packages].sort((a, b) => {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    if (a.version !== b.version) return a.version < b.version ? -1 : 1;
    return 0;
  });

  const notices: {
    name: string;
    version: string;
    license: string | null;
    repository: string | null;
  }[] = [];

  for (const pkg of sorted) {
    if (pkg.source === null) continue;
    const sourceDir = dirname(pkg.manifest_path);
    const dest = resolve(directory, "licenses", `${pkg.name}-${pkg.version}`);
    mkdirSync(dest, { recursive: true });

    const files = readdirSync(sourceDir)
      .filter((entry) =>
        /^(LICENSE|LICENCE|COPYING|COPYRIGHT|NOTICE)/i.test(entry),
      )
      .map((entry) => resolve(sourceDir, entry));

    if (pkg.license_file !== undefined && pkg.license_file !== null) {
      const explicit = resolve(sourceDir, pkg.license_file);
      if (!files.includes(explicit)) files.push(explicit);
    }

    const override = overrides[`${pkg.name}@${pkg.version}`];
    if (override !== undefined) {
      const vcs = JSON.parse(
        readFileSync(resolve(sourceDir, ".cargo_vcs_info.json"), "utf8"),
      ) as { git?: { sha1?: string } };
      const licensePath = resolve(overrideDir, override.file);
      if (vcs.git?.sha1 !== override.vcsRevision) {
        throw new Error(`VCS revision mismatch for ${pkg.name}@${pkg.version}`);
      }
      if (pkg.license !== override.license) {
        throw new Error(`License mismatch for ${pkg.name}@${pkg.version}`);
      }
      if (sha256Hex(readFileSync(licensePath)) !== override.sha256) {
        throw new Error(
          `Override license hash mismatch for ${pkg.name}@${pkg.version}`,
        );
      }
      files.push(licensePath);
    }

    if (files.length === 0) {
      throw new Error(`No distributable license/notice file for ${pkg.name}`);
    }

    for (const srcPath of files) {
      const targetPath = resolve(dest, basename(srcPath));
      if (statSync(srcPath).isDirectory()) {
        cpSync(srcPath, targetPath, {
          recursive: true,
          preserveTimestamps: true,
        });
      } else {
        copyFileSync(srcPath, targetPath);
      }
    }

    notices.push({
      name: pkg.name,
      version: pkg.version,
      license: pkg.license ?? null,
      repository: pkg.repository ?? null,
    });
  }

  writeFileSync(
    resolve(directory, "THIRD_PARTY.json"),
    `${JSON.stringify(
      {
        scope:
          "Locked workspace dependency notices (superset of linked native crates)",
        packages: notices,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

/**
 * Tagged macOS releases fail closed without signing/notary credentials.
 */
export function signMacos(
  binary: string,
  env: NodeJS.ProcessEnv = process.env,
  runner: CommandRunner = run,
): void {
  const names = [
    "MACOS_CERTIFICATE_BASE64",
    "MACOS_CERTIFICATE_PASSWORD",
    "MACOS_SIGNING_IDENTITY",
    "MACOS_NOTARY_KEY_BASE64",
    "MACOS_NOTARY_KEY_ID",
    "MACOS_NOTARY_ISSUER_ID",
  ] as const;

  for (const name of names) {
    const val = env[name];
    if (val === undefined || val.length === 0) {
      throw new Error(
        "Tagged macOS releases require configured signing and notarization secrets",
      );
    }
  }

  const folder = mkdtempSync(resolve(tmpdir(), "caret-macos-sign-"));
  const keychain = resolve(folder, "signing.keychain-db");
  let created = false;
  try {
    const certificate = resolve(folder, "signing.p12");
    const key = resolve(folder, "notary.p8");
    writeFileSync(certificate, decodeStrictBase64(env[names[0]] ?? ""));
    writeFileSync(key, decodeStrictBase64(env[names[3]] ?? ""));
    chmodSync(certificate, 0o600);
    chmodSync(key, 0o600);
    const password = randomBytes(32).toString("hex");
    try {
      runner(["security", "create-keychain", "-p", password, keychain], {
        silentStdout: true,
      });
      created = true;
      runner(["security", "unlock-keychain", "-p", password, keychain]);
      runner(
        [
          "security",
          "import",
          certificate,
          "-k",
          keychain,
          "-P",
          env[names[1]] ?? "",
          "-T",
          "/usr/bin/codesign",
        ],
        { silentStdout: true },
      );
      runner(
        [
          "security",
          "set-key-partition-list",
          "-S",
          "apple-tool:,apple:,codesign:",
          "-s",
          "-k",
          password,
          keychain,
        ],
        { silentStdout: true },
      );
      runner([
        "codesign",
        "--force",
        "--options",
        "runtime",
        "--timestamp",
        "--keychain",
        keychain,
        "--sign",
        env[names[2]] ?? "",
        binary,
      ]);
      runner(["codesign", "--verify", "--strict", "--verbose=2", binary]);
      const zipped = resolve(folder, "notarize.zip");
      runner(["ditto", "-c", "-k", "--keepParent", binary, zipped]);
      runner([
        "xcrun",
        "notarytool",
        "submit",
        zipped,
        "--key",
        key,
        "--key-id",
        env[names[4]] ?? "",
        "--issuer",
        env[names[5]] ?? "",
        "--wait",
      ]);
    } catch {
      // Never include credential-bearing subprocess arguments in a traceback.
      throw new Error("macOS signing or notarization failed");
    }
  } finally {
    if (created) {
      spawnSync("security", ["delete-keychain", keychain], {
        stdio: ["ignore", "ignore", "inherit"],
      });
    }
    rmSync(folder, { recursive: true, force: true });
  }
}

function isSupportedTarget(target: string): target is ReleaseTarget {
  return (TARGETS as readonly string[]).includes(target);
}

export function packageTarget(
  target?: string,
  runner: CommandRunner = run,
  env: NodeJS.ProcessEnv = process.env,
): string {
  let resolvedTarget = target;
  if (resolvedTarget === undefined) {
    const rustcOut = runner(["rustc", "-vV"]).stdout.toString("utf8");
    const hostLine = rustcOut
      .split(/\r?\n/)
      .find((line) => line.startsWith("host: "));
    if (hostLine === undefined) {
      throw new Error("Unable to detect host target from rustc -vV");
    }
    resolvedTarget = hostLine.slice("host: ".length).trim();
  }
  if (!isSupportedTarget(resolvedTarget)) {
    throw new Error(`Unsupported archive target: ${resolvedTarget}`);
  }

  const ver = version();
  const tag = env["GITHUB_REF_NAME"] ?? "";
  if (env["GITHUB_REF_TYPE"] === "tag" && tag !== `terminal-v${ver}`) {
    throw new Error("Terminal tag must match Cargo workspace version");
  }

  const head = runner(["git", "rev-parse", "HEAD"])
    .stdout.toString("utf8")
    .trim();
  const revision =
    env["CARET_BUILD_REV"] !== undefined && env["CARET_BUILD_REV"].length > 0
      ? env["CARET_BUILD_REV"]
      : head;
  if (revision !== head) {
    throw new Error("Archive build revision must match checked-out source");
  }

  runner(["git", "diff", "--quiet", "HEAD", "--"]);
  runner(
    [
      "cargo",
      "build",
      "--locked",
      "--release",
      "-p",
      "caret-tui",
      "--target",
      resolvedTarget,
    ],
    { env: { ...env, CARET_BUILD_REV: revision } },
  );

  const name = `caret-v${ver}-${resolvedTarget}`;
  const directory = resolve(OUT, name);
  if (existsSync(directory)) {
    rmSync(directory, { recursive: true, force: true });
  }
  mkdirSync(directory, { recursive: true });

  const binary = "caret";
  copyFileSync(
    resolve(ROOT, "target", resolvedTarget, "release", binary),
    resolve(directory, binary),
  );
  if (
    resolvedTarget.endsWith("apple-darwin") &&
    env["GITHUB_REF_TYPE"] === "tag"
  ) {
    signMacos(resolve(directory, binary), env, runner);
  }

  const docs: readonly (readonly [string, string])[] = [
    ["LICENSE", "LICENSE"],
    ["crates/caret-tui/assets/ATTRIBUTION.md", "ATTRIBUTION.md"],
    ["docs/rust-engine/terminal.md", "README.md"],
    ["docs/rust-engine/terminal-content.md", "terminal-content.md"],
    ["docs/rust-engine/terminal-storage.md", "terminal-storage.md"],
  ];
  for (const [src, dst] of docs) {
    copyFileSync(resolve(ROOT, src), resolve(directory, dst));
  }

  writeFileSync(
    resolve(directory, "SOURCE.md"),
    `Source revision: ${revision}\n\nGPL-3.0-only corresponding source is the matching caret-v${ver}-source.tar.gz release asset, including locked vendored dependencies.\n\nRepository: https://github.com/voltcrash/caret/tree/${revision}\n`,
    "utf8",
  );
  licenses(directory, resolvedTarget);
  const output = archive(directory);
  process.stdout.write(`Archive: ${output}\n`);
  return output;
}

function findNamedFiles(directory: string, filename: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...findNamedFiles(full, filename));
    } else if (entry.name === filename) {
      found.push(full);
    }
  }
  return found;
}

function smoke(archivePath: string): void {
  const expected = readFileSync(`${archivePath}.sha256`, "utf8")
    .trim()
    .split(/\s+/)[0];
  if (sha256Hex(readFileSync(archivePath)) !== expected) {
    throw new Error("Archive checksum mismatch");
  }

  const temporary = mkdtempSync(resolve(tmpdir(), "caret-install-"));
  try {
    run(["tar", "-xzf", archivePath, "-C", temporary]);
    const binaries = findNamedFiles(temporary, "caret");
    if (binaries.length !== 1 || binaries[0] === undefined) {
      throw new Error("Expected one installed executable");
    }
    const binary = binaries[0];
    const isolated = resolve(temporary, "empty");
    mkdirSync(isolated, { recursive: true });
    const env: NodeJS.ProcessEnv = { ...process.env, PATH: "" };

    for (const flag of [
      ["--version"],
      ["--help"],
      ["--diagnostics"],
      ["--smoke-test"],
    ]) {
      run([binary, ...flag], { cwd: isolated, env });
    }

    const diagnosticOut = capture([binary, "--diagnostics"], {
      cwd: isolated,
      env,
    });
    const versionInfo = JSON.parse(diagnosticOut) as {
      version: string;
      architecture: string;
    };
    const sourceFirstLine =
      readFileSync(resolve(dirname(binary), "SOURCE.md"), "utf8").split(
        /\r?\n/,
      )[0] ?? "";
    const revision = sourceFirstLine.startsWith("Source revision: ")
      ? sourceFirstLine.slice("Source revision: ".length)
      : sourceFirstLine;

    if (!versionInfo.version.includes(`build ${revision})`)) {
      throw new Error("Binary/source provenance mismatch");
    }
    const expectedArch = basename(dirname(binary)).includes("aarch64")
      ? "aarch64"
      : "x86_64";
    if (versionInfo.architecture !== expectedArch) {
      throw new Error(
        `Architecture mismatch: expected ${expectedArch}, got ${versionInfo.architecture}`,
      );
    }

    const exportPath = resolve(isolated, "history.json");
    run(
      [
        binary,
        "--config-dir",
        resolve(isolated, "config"),
        "--data-dir",
        resolve(isolated, "data"),
        "--export",
        exportPath,
      ],
      { cwd: isolated, env },
    );
    const exported = JSON.parse(readFileSync(exportPath, "utf8")) as {
      results: unknown[];
    };
    if (!Array.isArray(exported.results) || exported.results.length !== 0) {
      throw new Error("Expected empty export results for fresh install");
    }

    run([
      "cargo",
      "build",
      "--locked",
      "-p",
      "caret-tui",
      "--example",
      "terminal-harness",
    ]);
    const harness = resolve(ROOT, "target/debug/examples/terminal-harness");
    const ptyCheck = spawnSync(harness, ["pty", binary, "--release"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (ptyCheck.error !== undefined) throw ptyCheck.error;
    if (ptyCheck.status !== 0) {
      throw new Error(
        `Release PTY harness failed with exit code ${String(ptyCheck.status ?? 1)}`,
      );
    }
    process.stdout.write(
      "Installed archive: empty PATH/cwd, offline smoke, storage/export and supported POSIX PTY pass\n",
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function source(): void {
  mkdirSync(OUT, { recursive: true });
  const directory = resolve(OUT, `caret-v${version()}-source`);
  if (existsSync(directory)) {
    rmSync(directory, { recursive: true, force: true });
  }
  mkdirSync(directory, { recursive: true });

  const snapshot = run(["git", "archive", "--format=tar", "HEAD"]).stdout;
  run(["tar", "-xf", "-", "-C", directory], { input: snapshot });

  const vendorConfig = capture(
    ["cargo", "vendor", "--locked", "--versioned-dirs", "vendor"],
    { cwd: directory },
  );
  const cargoDir = resolve(directory, ".cargo");
  mkdirSync(cargoDir, { recursive: true });
  appendFileSync(resolve(cargoDir, "config.toml"), `\n${vendorConfig}`, "utf8");

  const revision =
    process.env["CARET_BUILD_REV"] !== undefined &&
    process.env["CARET_BUILD_REV"].length > 0
      ? process.env["CARET_BUILD_REV"]
      : capture(["git", "rev-parse", "HEAD"]).trim();
  writeFileSync(resolve(directory, "SOURCE_REVISION"), `${revision}\n`, "utf8");

  // Prove corresponding source can build without registry/network access.
  run(
    [
      "cargo",
      "check",
      "--offline",
      "--locked",
      "-p",
      "caret-tui",
      "--target-dir",
      resolve(ROOT, "target/terminal-source-check"),
    ],
    {
      cwd: directory,
      env: { ...process.env, CARET_BUILD_REV: revision },
    },
  );
  process.stdout.write(`Corresponding source: ${archive(directory)}\n`);
}

type VerificationMatrix = {
  formatVersion?: unknown;
  manualTerminals?: Record<
    string,
    { status?: unknown; evidence?: unknown } | undefined
  >;
};

export function gate(root: string = ROOT): void {
  const matrix = JSON.parse(
    readFileSync(
      resolve(root, "docs/rust-engine/terminal-verification.json"),
      "utf8",
    ),
  ) as VerificationMatrix;
  const terminals = matrix.manualTerminals ?? {};
  const keys = Object.keys(terminals);
  if (matrix.formatVersion !== 1 || keys.length !== 1 || keys[0] !== "macOS") {
    throw new Error(
      "Release verification requires the current macOS manual record; Linux emulator CI runs in the Linux x64 native job",
    );
  }
  const pending = Object.entries(terminals)
    .filter(
      ([, record]) =>
        record?.status !== "pass" ||
        typeof record.evidence !== "string" ||
        record.evidence.trim().length === 0,
    )
    .map(([name]) => name);
  if (pending.length > 0) {
    throw new Error(
      `Release manual terminal gate pending: ${pending.join(", ")}`,
    );
  }
}

export function checksums(directory: string, root: string = ROOT): void {
  const ver = version(root);
  const expected = [
    ...TARGETS.map((target) => `caret-v${ver}-${target}.tar.gz`),
    `caret-v${ver}-source.tar.gz`,
  ];
  const rows: string[] = [];
  for (const name of expected) {
    const filePath = resolve(directory, name);
    const digest = sha256Hex(readFileSync(filePath));
    const recorded = readFileSync(`${filePath}.sha256`, "utf8")
      .trim()
      .split(/\s+/)[0];
    if (recorded !== digest) {
      throw new Error(`Checksum mismatch for ${name}`);
    }
    rows.push(`${digest}  ${name}\n`);
  }
  writeFileSync(resolve(directory, "SHA256SUMS"), rows.join(""), "utf8");
}

function parseFlags(args: readonly string[]): {
  target?: string;
  archive?: string;
} {
  let target: string | undefined;
  let archivePath: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--target") {
      const next = args[++i];
      if (next === undefined) throw new Error("--target requires a value");
      target = next;
    } else if (arg?.startsWith("--target=")) {
      target = arg.slice("--target=".length);
    } else if (arg === "--archive") {
      const next = args[++i];
      if (next === undefined) throw new Error("--archive requires a value");
      archivePath = next;
    } else if (arg?.startsWith("--archive=")) {
      archivePath = arg.slice("--archive=".length);
    } else {
      throw new Error(`Unrecognized argument: ${arg ?? ""}`);
    }
  }
  return { target, archive: archivePath };
}

export function runReleaseCommand(
  command: string,
  args: readonly string[],
): void {
  const parsed = parseFlags(args);
  switch (command) {
    case "package":
      packageTarget(parsed.target);
      break;
    case "source":
      source();
      break;
    case "release-gate":
      gate();
      break;
    case "checksums":
      if (parsed.archive === undefined) {
        throw new Error("--archive is required for checksums");
      }
      checksums(resolve(parsed.archive));
      break;
    case "archive-smoke": {
      let archivePath = parsed.archive;
      if (archivePath === undefined) {
        if (parsed.target === undefined || !isSupportedTarget(parsed.target)) {
          throw new Error("--archive or a supported --target required");
        }
        archivePath = resolve(
          OUT,
          `caret-v${version()}-${parsed.target}.tar.gz`,
        );
      }
      smoke(resolve(archivePath));
      break;
    }
    default:
      throw new Error(`Unknown release command: ${command}`);
  }
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, ...rest] = process.argv.slice(2);
  if (command === undefined) {
    process.stderr.write(
      "Usage: node scripts/terminal-release.ts package|source|archive-smoke|release-gate|checksums [--target T] [--archive P]\n",
    );
    process.exit(2);
  }
  try {
    runReleaseCommand(command, rest);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}
