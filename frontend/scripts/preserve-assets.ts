import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";

const historyPath = "/_asset-history.json";
const safePath = /^\/(?:assets|js|css|webfonts)\/[\w.-]+\.(?:js|css|woff2)$/;
const legacyHashed =
  /^\/(?:js|css|webfonts)\/[\w.-]+\.[\w-]{8}\.(?:js|css|woff2)$/;
const historySchema = z.object({
  files: z.record(
    z.string().regex(safePath),
    z.string().regex(/^[a-f0-9]{64}$/),
  ),
});
const digest = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
export type PreviousAssets = Map<string, Uint8Array>;

/** Capture only public content-addressed files, never documents, RPCs or sessions. */
export async function snapshotAssets(
  origin: string,
  request: typeof fetch = fetch,
): Promise<PreviousAssets> {
  const get = async (path: string): Promise<Response> =>
    await request(new URL(path, origin), {
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(30_000),
    });
  const version = async (): Promise<string> => {
    const response = await get("/version.json");
    if (!response.ok) {
      throw new Error("Cannot identify the previous deployment");
    }
    return z.object({ version: z.string() }).parse(await response.json())
      .version;
  };
  const before = await version();
  const history = await get(historyPath);
  const files: PreviousAssets = new Map();
  const expected = history.ok
    ? historySchema.parse(await history.json()).files
    : undefined;
  if (!history.ok && history.status !== 404) {
    throw new Error("Cannot read previous public asset history");
  }
  const pending = Object.keys(expected ?? {});
  if (expected === undefined) {
    const html = await get("/");
    if (!html.ok) {
      throw new Error(
        "Cannot capture the legacy document's public asset references",
      );
    }
    pending.push(...references(await html.text(), origin, origin));
    if (pending.length === 0) {
      throw new Error("Previous legacy asset graph is empty");
    }
  }
  while (pending.length > 0) {
    const paths = [...new Set(pending.splice(0, 8))].filter(
      (path) => !files.has(path),
    );
    if (files.size + paths.length > 18_000) {
      throw new Error(
        "Review asset compatibility retention before exceeding the delivery limit",
      );
    }
    const batch = await Promise.all(
      paths.map(async (path) => {
        const response = await get(path);
        if (!response.ok) {
          throw new Error(`Previous asset unavailable: ${path}`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (expected !== undefined && digest(bytes) !== expected[path]) {
          throw new Error(`Previous asset changed: ${path}`);
        }
        return { path, bytes };
      }),
    );
    for (const { path, bytes } of batch) {
      files.set(path, bytes);
      if (expected === undefined && /\.(?:js|css)$/.test(path)) {
        pending.push(
          ...references(
            new TextDecoder().decode(bytes),
            new URL(path, origin).href,
            origin,
          ),
        );
      }
    }
  }
  if ((await version()) !== before) {
    throw new Error("Deployment changed during asset capture; rebuild");
  }
  return files;
}

function references(source: string, base: string, origin: string): string[] {
  const matches = source.matchAll(
    /["'`(]([^"'`\s()<>]+\.(?:js|css|woff2))(?:[?#][^"'`\s()<>]*)?["'`)]/g,
  );
  return [...matches]
    .flatMap((match) => (match[1] ?? "").split(","))
    .flatMap((value) => {
      const url = new URL(
        value,
        /^(?:assets|js|css|webfonts)\//.test(value) ? origin : base,
      );
      const versioned =
        legacyHashed.test(url.pathname) ||
        (url.pathname.startsWith("/assets/") && safePath.test(url.pathname));
      return url.origin === new URL(origin).origin && versioned
        ? [url.pathname]
        : [];
    });
}

/** Append previous hashes to the new artifact and publish their integrity index. */
export async function preserveAssets(
  directory: string,
  previous: PreviousAssets,
): Promise<void> {
  for (const [path, bytes] of previous) {
    if (!safePath.test(path)) {
      throw new Error("Unsafe public compatibility asset path");
    }
    const target = resolve(directory, `.${path}`);
    try {
      const current = await readFile(target);
      if (digest(current) !== digest(bytes)) {
        throw new Error(`Content-addressed asset collision: ${path}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
  }
  const paths = new Set(previous.keys());
  for (const name of await readdir(resolve(directory, "assets"))) {
    if (/\.(?:js|css|woff2)$/.test(name)) paths.add(`/assets/${name}`);
  }
  const files: Record<string, string> = {};
  for (const path of [...paths].sort()) {
    files[path] = digest(await readFile(resolve(directory, `.${path}`)));
  }
  // Removal requires the ledger's compatibility/traffic gate, never build age.
  await writeFile(
    resolve(directory, `.${historyPath}`),
    `${JSON.stringify({ files })}\n`,
  );
}
