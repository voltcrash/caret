/**
 * Archive integrity and supported release targets, using actual files.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  archive,
  checksum,
  checksums,
  gate,
  packageTarget,
  signMacos,
  TARGETS,
  version,
} from "./terminal-release.ts";

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(resolve(tmpdir(), "caret-release-test-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await describe("terminal release tooling", async () => {
  await it("requires macOS signing credentials before running tools", () => {
    let ran = false;
    assert.throws(
      () =>
        signMacos("caret", {}, () => {
          ran = true;
          return { stdout: Buffer.alloc(0) };
        }),
      /signing and notarization/,
    );
    assert.equal(ran, false);
  });

  await it("preserves binary bytes, permissions, and timestamps in tarballs", () => {
    withTempDir((temporary) => {
      const directory = resolve(temporary, "candidate");
      mkdirSync(directory);
      const source = resolve(directory, "caret");
      const content = Buffer.from([
        ...Buffer.from("Binary bytes\n"),
        0x00,
        0xff,
      ]);
      writeFileSync(source, content);
      chmodSync(source, 0o755);
      utimesSync(source, 1, 1);

      const archivePath = archive(directory);
      const extractDir = resolve(temporary, "extracted");
      mkdirSync(extractDir);
      const extracted = spawnSync(
        "tar",
        ["-xzpf", archivePath, "-C", extractDir],
        { encoding: "utf8" },
      );
      assert.equal(extracted.status, 0, extracted.stderr);

      const extractedBinary = resolve(extractDir, "candidate/caret");
      assert.deepEqual(readFileSync(extractedBinary), content);
      assert.equal(statSync(extractedBinary).mode & 0o777, 0o755);
      assert.equal(Math.trunc(statSync(extractedBinary).mtimeMs / 1000), 1);

      // Source file remains intact.
      assert.deepEqual(readFileSync(source), content);
      assert.equal(Math.trunc(statSync(source).mtimeMs / 1000), 1);

      const expected = readFileSync(`${archivePath}.sha256`, "utf8")
        .trim()
        .split(/\s+/)[0];
      const actual = createHash("sha256")
        .update(readFileSync(archivePath))
        .digest("hex");
      assert.equal(actual, expected);
    });
  });

  await it("rejects unsupported targets before building", () => {
    let ran = false;
    assert.throws(
      () =>
        packageTarget("x86_64-pc-windows-msvc", () => {
          ran = true;
          return { stdout: Buffer.alloc(0) };
        }),
      /Unsupported archive target/,
    );
    assert.equal(ran, false);
  });

  await it("requires four unix binaries and corresponding source for checksums", () => {
    assert.deepEqual(
      new Set(TARGETS),
      new Set([
        "x86_64-unknown-linux-gnu",
        "aarch64-unknown-linux-gnu",
        "x86_64-apple-darwin",
        "aarch64-apple-darwin",
      ]),
    );
    withTempDir((root) => {
      const ver = version();
      const names = [...TARGETS, "source"].map(
        (target) => `caret-v${ver}-${target}.tar.gz`,
      );
      for (const name of names) {
        const filePath = resolve(root, name);
        writeFileSync(filePath, Buffer.from(name, "utf8"));
        checksum(filePath);
      }
      checksums(root);
      const lines = readFileSync(resolve(root, "SHA256SUMS"), "utf8")
        .trimEnd()
        .split("\n");
      assert.equal(lines.length, 5);
      for (let i = 0; i < names.length; i += 1) {
        const name = names[i];
        assert.ok(name !== undefined);
        const expectedDigest = createHash("sha256")
          .update(Buffer.from(name, "utf8"))
          .digest("hex");
        assert.equal(lines[i], `${expectedDigest}  ${name}`);
      }

      const first = names[0];
      assert.ok(first !== undefined);
      writeFileSync(resolve(root, first), Buffer.from("corruption"));
      assert.throws(() => checksums(root), /Checksum mismatch/);
    });
  });

  await it("requires the owner macOS record and never accepts an empty matrix", () => {
    withTempDir((root) => {
      const matrix = resolve(
        root,
        "docs/rust-engine/terminal-verification.json",
      );
      mkdirSync(resolve(root, "docs/rust-engine"), { recursive: true });
      for (const record of [
        {},
        { status: "pending", evidence: null },
        { status: "pass", evidence: " " },
      ]) {
        writeFileSync(
          matrix,
          JSON.stringify({
            formatVersion: 1,
            manualTerminals: { macOS: record },
          }),
        );
        assert.throws(() => gate(root), /gate pending/);
      }
      writeFileSync(
        matrix,
        JSON.stringify({ formatVersion: 1, manualTerminals: {} }),
      );
      assert.throws(() => gate(root), /requires the current macOS/);

      writeFileSync(
        matrix,
        JSON.stringify({
          formatVersion: 1,
          manualTerminals: {
            macOS: { status: "pass", evidence: "test record only" },
          },
        }),
      );
      gate(root);
    });
  });
});
