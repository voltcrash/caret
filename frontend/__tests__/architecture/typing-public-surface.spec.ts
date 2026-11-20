import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { root, sources, specifiers, target } from "./imports";

const typing = resolve(root, "src/features/typing");
const surfaceFile = resolve(import.meta.dirname, "typing-public-surface.json");

/** Typing modules that code outside the typing feature imports. */
function typingSurface(): string[] {
  const modules = new Set<string>();
  for (const file of sources(resolve(root, "src"))) {
    if (file.startsWith(`${typing}/`)) continue;
    for (const specifier of specifiers(file, readFileSync(file, "utf8"))) {
      const path = target(file, specifier);
      if (path === undefined || !path.startsWith(`${typing}/`)) continue;
      modules.add(relative(typing, path).replace(/\.tsx?$/, ""));
    }
  }
  return [...modules].toSorted();
}

describe("typing public surface", () => {
  // Code outside the feature should reach typing through a few entry points.
  // The recorded surface is a ratchet: shrink it, never grow it.
  it("exposes no typing modules beyond the recorded surface", () => {
    const surface = JSON.parse(readFileSync(surfaceFile, "utf8")) as string[];
    const actual = typingSurface();
    expect(
      actual.filter((module) => !surface.includes(module)),
      "new typing entry points; route the caller through an existing one",
    ).toEqual([]);
    expect(
      surface.filter((module) => !actual.includes(module)),
      "unused entry points; delete them from typing-public-surface.json",
    ).toEqual([]);
  });
});
