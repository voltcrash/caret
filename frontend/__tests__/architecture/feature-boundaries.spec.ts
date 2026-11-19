import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { parseSync } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";

const root = resolve(import.meta.dirname, "../..");
const shared = [resolve(root, "src/ts")];
const features = resolve(root, "src/features");
const baselineFile = resolve(
  import.meta.dirname,
  "shared-feature-imports.json",
);

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Module specifiers from the AST: static, re-export, side-effect and dynamic imports. */
function specifiers(file: string, source: string): string[] {
  const { module, errors } = parseSync(file, source, {
    lang: file.endsWith(".tsx") ? "tsx" : "ts",
  });
  if (errors.length > 0) throw new Error(`Cannot parse ${file}`);
  return [
    ...module.staticImports.map((entry) => entry.moduleRequest.value),
    ...module.staticExports.flatMap((entry) =>
      entry.entries.flatMap((item) =>
        item.moduleRequest === null ? [] : [item.moduleRequest.value],
      ),
    ),
    ...module.dynamicImports.map((entry) =>
      source
        .slice(entry.moduleRequest.start, entry.moduleRequest.end)
        .replaceAll(/^["'`]|["'`]$/g, ""),
    ),
  ];
}

/** `importer -> feature module` for every shared module importing a feature. */
function sharedFeatureImports(): string[] {
  const edges = new Set<string>();
  for (const file of shared.flatMap(sources)) {
    for (const specifier of specifiers(file, readFileSync(file, "utf8"))) {
      if (!specifier.startsWith(".")) continue;
      const target = resolve(dirname(file), specifier);
      if (!target.startsWith(`${features}/`)) continue;
      edges.add(
        `${relative(root, file)} -> ${relative(root, target).replace(/\.tsx?$/, "")}`,
      );
    }
  }
  return [...edges].toSorted();
}

describe("shared code and features", () => {
  // Shared code (src/ts) should not depend on features. Existing edges are a
  // ratchet: remove entries as they are untangled, never add new ones.
  it("adds no shared-to-feature imports beyond the recorded baseline", () => {
    const baseline = JSON.parse(readFileSync(baselineFile, "utf8")) as string[];
    const actual = sharedFeatureImports();
    expect(
      actual.filter((edge) => !baseline.includes(edge)),
      "new shared-to-feature imports; move the code into the feature or invert the dependency",
    ).toEqual([]);
    expect(
      baseline.filter((edge) => !actual.includes(edge)),
      "removed edges; delete them from shared-feature-imports.json",
    ).toEqual([]);
  });
});
