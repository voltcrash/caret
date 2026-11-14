import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vite-plus/test";
import { generateIconData } from "../../vite-plugins/icon-data";
import { icons } from "../../src/components/icons/data";

it("keeps generated paths identical to the owned SVG sources", () => {
  expect(generateIconData()).toBe(
    readFileSync(
      new URL("../../src/components/icons/data.ts", import.meta.url),
      "utf8",
    ),
  );
});

it("covers icon names in source data as well as JSX literals", () => {
  const names = new Set([
    ...Object.values(icons).flatMap(Object.keys),
    "fa-fw",
    "fa-spin",
    "fa-rotate-90",
  ]);
  const root = resolve(import.meta.dirname, "../../src");
  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (
      !/\.tsx?$/.test(file) ||
      file.endsWith(".d.ts") ||
      file === "components/icons/data.ts"
    ) {
      continue;
    }
    const source = readFileSync(resolve(root, file), "utf8");
    for (const match of source.matchAll(/\bfa-[a-z0-9]+(?:-[a-z0-9]+)*/g)) {
      expect(names.has(match[0]), `${file}: ${match[0]}`).toBe(true);
    }
  }
});
