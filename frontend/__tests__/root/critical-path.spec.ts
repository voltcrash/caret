import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vite-plus/test";

// Contracts, the ts-rest client and challenge definitions load on demand so
// they stay out of the startup chunks. Type-only imports are erased.

const SRC = resolve(fileURLToPath(import.meta.url), "../../../src/ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function staticValueImports(source: string): string[] {
  return [
    ...source.matchAll(/^import\s+(?!type\b)([^;]*?)\s+from\s+"([^"]+)"/gms),
  ]
    .filter(
      ([, clause]) => !/^\{\s*(?:type\s+[\w$]+\s*,?\s*)+\}$/.test(clause ?? ""),
    )
    .map(([, , specifier]) => specifier ?? "");
}

const lazyOnly: Record<string, RegExp> = {
  contracts: /^@caret\/contracts(?:\/(?!compatibility$|util\/api$).+)?$/,
  challenges: /^@caret\/challenges$/,
  "ts-rest adapter": /ape\/adapters\/ts-rest-adapter$/,
};

// Only reached through the command palette, which loads on demand.
const lazyModules = new Set(["commandline/lists/load-challenge.ts"]);

describe("startup imports", () => {
  const files = sourceFiles(SRC).filter(
    (file) => !lazyModules.has(relative(SRC, file)),
  );

  it.each(Object.entries(lazyOnly))(
    "keeps %s behind dynamic imports",
    (_name, pattern) => {
      const offenders = files.flatMap((file) =>
        staticValueImports(readFileSync(file, "utf-8"))
          .filter((specifier) => pattern.test(specifier))
          .map((specifier) => `${relative(SRC, file)} -> ${specifier}`),
      );
      expect(offenders).toEqual([]);
    },
  );
});
