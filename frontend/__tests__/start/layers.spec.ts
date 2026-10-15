import { describe, expect, it } from "vite-plus/test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, matchesGlob, relative, resolve } from "node:path";

import { ssrSafeLegacyFiles } from "../../vite-plugins/import-boundaries";

const root = resolve(import.meta.dirname, "../..");
const src = resolve(root, "src");

// Value imports, re-exports, side-effect and dynamic imports; `import type`
// never reaches a runtime graph and is ignored.
const importPattern =
  /(?:import|export)\s+(?!type\b)(?:[\w*{}\s,]+?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

type Edge = { from: string; to: string; dynamic: boolean };

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".d.ts"))
    .map((name) => resolve(dir, name));
}

function resolveLocal(from: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = resolve(dirname(from), specifier.replace(/\?.*$/, ""));
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, "index.ts"),
    resolve(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return relative(root, candidate);
    }
  }
  return relative(root, base);
}

const edges: Edge[] = files(src).flatMap((file) => {
  const code = readFileSync(file, "utf8");
  return [...code.matchAll(importPattern)].flatMap((match) => {
    const specifier = match[1] ?? match[2] ?? "";
    const to = resolveLocal(file, specifier) ?? specifier;
    return [
      { from: relative(root, file), to, dynamic: match[2] !== undefined },
    ];
  });
});

const is = (path: string, ...globs: string[]): boolean =>
  globs.some((glob) => matchesGlob(path, glob));

const serverLayer = [
  "src/server/**",
  "src/functions/**",
  "src/start.ts",
  "src/server.ts",
  "src/worker.ts",
];

function violations(
  from: string[],
  forbidden: (edge: Edge) => boolean,
): string[] {
  return edges
    .filter((edge) => is(edge.from, ...from) && forbidden(edge))
    .map((edge) => `${edge.from} → ${edge.to}`);
}

describe("source layer boundaries", () => {
  it("parses static, local and dynamic edges", () => {
    const has = (from: string, to: string, dynamic = false): boolean =>
      edges.some(
        (edge) =>
          edge.from === from && edge.to === to && edge.dynamic === dynamic,
      );
    expect(has("src/worker.ts", "src/server.ts")).toBe(true);
    expect(
      has(
        "src/routes/oauth-callback[.]html.tsx",
        "src/features/auth/callback.tsx",
      ),
    ).toBe(true);
    expect(has("src/ts/auth.tsx", "src/ts/collections/tags.ts", true)).toBe(
      true,
    );
    expect(edges.length).toBeGreaterThan(1000);
  });

  it("keeps server code away from browser application modules", () => {
    expect(
      violations(serverLayer, (edge) =>
        is(edge.to, "src/ts/**", "src/app/**", "src/routes/**"),
      ),
    ).toEqual([]);
  });

  it("keeps legacy browser modules away from server code and backend", () => {
    expect(
      violations(
        ["src/ts/**"],
        (edge) =>
          is(edge.to, ...serverLayer, "src/routes/**", "**/*.server.*") ||
          edge.to.startsWith("@oxytype/backend"),
      ),
    ).toEqual([]);
  });

  it("keeps SSR-rendered app owners free of legacy browser state", () => {
    expect(
      violations(
        [
          "src/app/**",
          "src/routes/**",
          "src/components/**",
          "src/features/**",
          "src/router.tsx",
        ],
        (edge) =>
          !is(edge.from, "**/*.client.*") &&
          is(edge.to, "src/ts/**") &&
          !is(edge.to, ...ssrSafeLegacyFiles),
      ),
    ).toEqual([]);
  });

  it("imports the backend only through narrow server-only subpaths", () => {
    expect(
      edges
        .filter((edge) => edge.to === "@oxytype/backend")
        .map((edge) => edge.from),
    ).toEqual([]);
  });
});
