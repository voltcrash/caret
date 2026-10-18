import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Settings = { buildId: string; siteKey: string; providers: string };
type Receipt = Settings & { files: Record<string, string> };

async function fingerprints(
  directory: string,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const name of (
    await readdir(directory, { recursive: true, withFileTypes: true })
  )
    .filter((entry) => entry.isFile())
    .map((entry) =>
      resolve(entry.parentPath, entry.name).slice(directory.length + 1),
    )
    .sort()) {
    if (name === "artifact.json") continue;
    if (name.split("/").some((part) => part.startsWith(".dev.vars"))) {
      throw new Error(
        "Private preview variables cannot be part of a release artifact",
      );
    }
    files[name] = createHash("sha256")
      .update(await readFile(resolve(directory, name)))
      .digest("hex");
  }
  return files;
}

/** Seal one completed build. Receipt is outside the publicly served client tree. */
export async function writeArtifact(
  directory: string,
  settings: Settings,
): Promise<void> {
  // Cloudflare may emit local preview settings; never archive/deploy those.
  await rm(resolve(directory, "server/.dev.vars"), { force: true });
  const receipt: Receipt = {
    ...settings,
    files: await fingerprints(directory),
  };
  await writeFile(
    resolve(directory, "artifact.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
}

export async function validateArtifact(
  directory: string,
  expected: {
    siteKey: string;
    providers: string;
    config: unknown;
  },
): Promise<void> {
  const receipt = JSON.parse(
    await readFile(resolve(directory, "artifact.json"), "utf8"),
  ) as Receipt;
  if (
    receipt.siteKey !== expected.siteKey ||
    receipt.providers !== expected.providers ||
    JSON.stringify(await fingerprints(directory)) !==
      JSON.stringify(receipt.files)
  ) {
    throw new Error(
      "Release artifact changed or uses different public settings; rebuild production",
    );
  }
  const built = JSON.parse(
    await readFile(resolve(directory, "server/wrangler.json"), "utf8"),
  ) as Record<string, unknown>;
  const source = expected.config as Record<string, unknown>;
  for (const key of [
    "name",
    "account_id",
    "routes",
    "d1_databases",
    "queues",
    "triggers",
    "compatibility_date",
    "compatibility_flags",
    "secrets",
    "workers_dev",
    "preview_urls",
    "observability",
  ]) {
    // Wrangler normalizes D1 migration paths and adds defaults; compare resource
    // identities below instead of requiring identical generated configuration.
    if (key === "d1_databases") continue;
    if (JSON.stringify(built[key]) !== JSON.stringify(source[key])) {
      throw new Error(`Production artifact has a different ${key}`);
    }
  }
  const vars = built["vars"] as Record<string, string>;
  const sourceVars = source["vars"] as Record<string, string>;
  const databases = built["d1_databases"] as { database_id: string }[];
  const sourceDatabases = source["d1_databases"] as { database_id: string }[];
  const version = JSON.parse(
    await readFile(resolve(directory, "client/version.json"), "utf8"),
  ) as { version: string };
  if (
    vars["VERSION"] !== receipt.buildId ||
    version.version !== receipt.buildId ||
    vars["MODE"] !== "production" ||
    vars["FRONTEND_URL"] !== sourceVars["FRONTEND_URL"] ||
    vars["BETTER_AUTH_URL"] !== sourceVars["BETTER_AUTH_URL"] ||
    databases[0]?.database_id !== sourceDatabases[0]?.database_id
  ) {
    throw new Error(
      "Production Worker, client and resources must belong to one release",
    );
  }
}
