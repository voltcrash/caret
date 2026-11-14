import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const selection = JSON.parse(
  readFileSync(new URL("../../icons/selection.json", import.meta.url), "utf8"),
) as Record<string, Record<string, string>>;
const known = new Set(
  Object.values(selection).flatMap((entries) => [
    ...Object.keys(entries),
    ...Object.values(entries).map(
      (file) => `fa-${path.basename(file, ".svg")}`,
    ),
  ]),
);
const icons = readFileSync(
  path.join(import.meta.dirname, "../../src/styles/icons.css"),
  "utf8",
);

describe("icon size corrections", () => {
  const selectors = [...icons.matchAll(/\.(fa-[a-z0-9-]+)/g)]
    .map((match) => match[1] as string)
    .filter((name) => name !== "fa-fw" && name !== "fa-rotate-90");

  it("has corrections", () => {
    expect(selectors.length).toBeGreaterThan(0);
  });

  it.each(selectors)("targets a font awesome icon (%s)", (selector) => {
    expect(known.has(selector)).toBe(true);
  });

  it("only uses scale so layout and spin transforms are untouched", () => {
    const properties = [...icons.matchAll(/^\s+([a-z-]+):/gm)].map(
      (match) => match[1],
    );
    expect(new Set(properties)).toEqual(new Set(["scale"]));
  });
});
