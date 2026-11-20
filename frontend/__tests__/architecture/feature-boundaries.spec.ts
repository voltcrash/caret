import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { root, sources, specifiers, target } from "./imports";

const shared = [resolve(root, "src/ts"), resolve(root, "src/data")];
const features = resolve(root, "src/features");
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
  it("resolves package imports before checking their boundaries", () => {
    expect(target(import.meta.filename, "#features/typing/page.tsx")).toBe(
      resolve(features, "typing/page.tsx"),
    );
  });

  it("keeps shared modules independent of features", () => {
    expect(sharedFeatureImports()).toEqual([]);
  });
});
