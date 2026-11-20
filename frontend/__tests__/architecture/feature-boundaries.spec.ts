import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { root, sources, specifiers, target } from "./imports";

const shared = [resolve(root, "src/ts"), resolve(root, "src/data")];
const features = resolve(root, "src/features");
const baselineFile = resolve(
  import.meta.dirname,
  "shared-feature-imports.json",
);

/** `importer -> feature module` for every shared module importing a feature. */
function sharedFeatureImports(): string[] {
  const edges = new Set<string>();
  for (const file of shared.flatMap(sources)) {
    for (const specifier of specifiers(file, readFileSync(file, "utf8"))) {
      const path = target(file, specifier);
      if (path === undefined || !path.startsWith(`${features}/`)) continue;
      edges.add(
        `${relative(root, file)} -> ${relative(root, path).replace(/\.tsx?$/, "")}`,
      );
    }
  }
  return [...edges].toSorted();
}

describe("shared code and features", () => {
  // Shared code (src/ts, src/data) should not depend on features. Existing edges are a
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
