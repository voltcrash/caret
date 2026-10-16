import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it, vi } from "vite-plus/test";
import { preserveAssets, snapshotAssets } from "../../scripts/preserve-assets";

const origin = "https://fixture.test";
const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
function fixture(files: Record<string, string>): {
  request: typeof fetch;
  paths: string[];
} {
  const paths: string[] = [];
  const request: typeof fetch = vi.fn(async (input, options) => {
    expect(options?.credentials).toBe("omit");
    const path = new URL(String(input)).pathname;
    paths.push(path);
    const text =
      path === "/version.json" ? '{"version":"previous-build"}' : files[path];
    return new Response(text ?? "missing", {
      status: text === undefined ? 404 : 200,
    });
  });
  return { request, paths };
}

it("captures the legacy lazy JS/CSS/font graph without fetching private routes", async () => {
  const { request, paths } = fixture({
    "/": '<script type="module" src="/js/main.1234abcd.js"></script>',
    "/js/main.1234abcd.js":
      'import("./lazy.abcd1234.js"); const deps="js/lazy.abcd1234.js,css/lazy.1234abcd.css".split(","); const api="/api/private.js";',
    "/js/lazy.abcd1234.js": "export default 1;",
    "/css/lazy.1234abcd.css":
      "@font-face{src:url(../webfonts/font.abcd1234.woff2)}",
    "/webfonts/font.abcd1234.woff2": "font bytes",
  });
  const assets = await snapshotAssets(origin, request);
  expect([...assets.keys()].sort()).toEqual([
    "/css/lazy.1234abcd.css",
    "/js/lazy.abcd1234.js",
    "/js/main.1234abcd.js",
    "/webfonts/font.abcd1234.woff2",
  ]);
  expect(paths.some((path) => path.startsWith("/api/"))).toBe(false);
  expect(paths.filter((path) => path === "/version.json")).toHaveLength(2);
});

it("uses Start's public integrity index without assuming a filename hash length", async () => {
  const path = "/assets/module-long-build-hash.js";
  const source = "export default 1;";
  const { request, paths } = fixture({
    "/_asset-history.json": JSON.stringify({ files: { [path]: hash(source) } }),
    [path]: source,
  });
  expect(
    [...(await snapshotAssets(origin, request))].map(([path]) => path),
  ).toEqual([path]);
  expect(paths).not.toContain("/");
  const invalid = fixture({
    "/_asset-history.json": JSON.stringify({
      files: { [path]: hash("other bytes") },
    }),
    [path]: source,
  });
  await expect(snapshotAssets(origin, invalid.request)).rejects.toThrow(
    "Previous asset changed",
  );
});

it("fails closed for a missing dependency and for non-public history entries", async () => {
  const missing = fixture({
    "/": '<script src="/js/main.1234abcd.js"></script>',
  });
  await expect(snapshotAssets(origin, missing.request)).rejects.toThrow(
    "Previous asset unavailable",
  );
  const privateHistory = fixture({
    "/_asset-history.json": JSON.stringify({
      files: { "/_serverFn/private": hash("secret") },
    }),
  });
  await expect(
    snapshotAssets(origin, privateHistory.request),
  ).rejects.toThrow();
});

it("retains previous files in the artifact and rejects conflicting content-addressed URLs", async () => {
  const directory = await mkdtemp(
    resolve(tmpdir(), "oxytype-previous-assets-"),
  );
  try {
    await mkdir(resolve(directory, "assets"));
    await writeFile(resolve(directory, "assets/new-anyhash.js"), "new build");
    const previous = new Map([
      ["/js/main.1234abcd.js", new TextEncoder().encode("old build")],
    ]);
    await preserveAssets(directory, previous);
    expect(
      await readFile(resolve(directory, "js/main.1234abcd.js"), "utf8"),
    ).toBe("old build");
    expect(
      JSON.parse(
        await readFile(resolve(directory, "_asset-history.json"), "utf8"),
      ),
    ).toEqual({
      files: {
        "/assets/new-anyhash.js": hash("new build"),
        "/js/main.1234abcd.js": hash("old build"),
      },
    });
    await expect(
      preserveAssets(
        directory,
        new Map([
          ["/assets/new-anyhash.js", new TextEncoder().encode("different")],
        ]),
      ),
    ).rejects.toThrow("collision");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
