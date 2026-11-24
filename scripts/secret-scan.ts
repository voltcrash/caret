import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type SecretPattern = {
  readonly name: string;
  readonly regex: RegExp;
};

type Finding = {
  readonly file: string;
  readonly line: number;
  readonly pattern: string;
};

const PATTERNS: readonly SecretPattern[] = [
  {
    name: "GitHub token",
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/,
  },
  {
    name: "AWS access key ID",
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    name: "Google API key",
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    name: "Stripe live secret key",
    regex: /\b(?:sk|rk)_live_[0-9A-Za-z]{24,}\b/,
  },
  {
    name: "PEM private key header",
    regex:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/,
  },
];

const root = resolve(import.meta.dirname, "..");
const trackedOutput = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "buffer",
  maxBuffer: 32 * 1024 * 1024,
});

const trackedFiles = trackedOutput
  .toString("utf8")
  .split("\0")
  .filter((file) => file.length > 0);

let textFilesScanned = 0;
const findings: Finding[] = [];

for (const file of trackedFiles) {
  const buffer = readFileSync(resolve(root, file));
  if (buffer.includes(0)) continue;

  textFilesScanned += 1;
  const lines = buffer.toString("utf8").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineText = lines[index];
    if (lineText === undefined) continue;

    for (const pattern of PATTERNS) {
      if (pattern.regex.test(lineText)) {
        findings.push({
          file,
          line: index + 1,
          pattern: pattern.name,
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error(
    `Secret pattern scan failed: ${findings.length} match(es) across ${textFilesScanned} text files (${trackedFiles.length} tracked files).`,
  );
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line} [${finding.pattern}]`);
  }
  process.exit(1);
}

console.log(
  `Secret pattern scan passed: 0 matches across ${textFilesScanned} text files (${trackedFiles.length} tracked files).`,
);
