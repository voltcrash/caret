import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getDateVersion } from "./version.js";

/** npm semver rejects the zero-padded month/day used by production tags. */
export function getTerminalVersion(value = getDateVersion()) {
  const match =
    /^v?(\d{2})\.(\d{1,2})\.(\d{1,2})(-(?:alpha|beta|rc)\.[1-9]\d*)?$/.exec(
      value,
    );
  if (match === null) throw new Error("Expected YY.M.D or YY.M.D-rc.N");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(2000 + year, month - 1, day));
  if (
    date.getUTCFullYear() !== 2000 + year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Terminal version must contain a valid UTC date");
  }
  return `${year}.${month}.${day}${match[4] ?? ""}`;
}

export async function prepareTerminalRelease({
  cwd,
  sha,
  version,
  channel = "latest",
  fetch = globalThis.fetch,
}) {
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
  }).trim();
  if (head !== sha) {
    throw new Error("Terminal release checkout must match the workflow commit");
  }
  const normalized = getTerminalVersion(version === "" ? undefined : version);
  if (
    !["latest", "next"].includes(channel) ||
    (normalized.includes("-") && channel === "latest")
  ) {
    throw new Error(
      "Use next for prereleases; supported channels: latest, next",
    );
  }
  const response = await fetch(
    `https://registry.npmjs.org/@voltcrash%2foxytype/${normalized}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  let shouldPublish = true;
  if (response.status === 200) {
    const published = await response.json();
    if (published.gitHead !== sha) {
      throw new Error(
        `Terminal version ${normalized} is already published from another commit`,
      );
    }
    shouldPublish = false;
  } else if (response.status !== 404) {
    throw new Error(`Could not check npm publication (${response.status})`);
  }
  const path = join(cwd, "tui/package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  if (pkg.name !== "@voltcrash/oxytype") {
    throw new Error("Unexpected terminal package name");
  }
  pkg.version = normalized;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  return { version: normalized, sha, channel, shouldPublish };
}
