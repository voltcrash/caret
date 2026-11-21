import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { parseSync } from "vite-plus";

import { root, sources, target } from "./imports";

const state = resolve(root, "src/ts/states/test.ts");
const typing = resolve(root, "src/features/typing");

function parse(file: string): ReturnType<typeof parseSync>["module"] {
  return parseSync(file, readFileSync(file, "utf8"), {
    lang: file.endsWith(".tsx") ? "tsx" : "ts",
  }).module;
}

/** Names that application code outside the typing feature imports from the shared test state. */
function sharedConsumers(): Set<string> {
  const names = new Set<string>();
  for (const file of sources(resolve(root, "src"))) {
    if (file === state || file.startsWith(`${typing}/`)) continue;
    for (const { moduleRequest, entries } of parse(file).staticImports) {
      const path = target(file, moduleRequest.value)?.replace(
        /(\.ts)?$/,
        ".ts",
      );
      if (path !== state) continue;
      for (const { importName } of entries) {
        if (importName.name !== null) names.add(importName.name);
      }
    }
  }
  return names;
}

describe("shared test state", () => {
  // Typing-only state belongs in features/typing/state. Each export statement
  // (a signal and its setter, say) needs a consumer outside the feature.
  it("exports only state that code outside the typing feature reads", () => {
    const consumers = sharedConsumers();
    const unused = parse(state)
      .staticExports.map(({ entries }) =>
        entries.map(({ exportName }) => exportName.name ?? ""),
      )
      .filter((group) => !group.some((name) => consumers.has(name)));
    expect(
      unused,
      `move typing-only state out of ${relative(root, state)}`,
    ).toEqual([]);
  });
});
