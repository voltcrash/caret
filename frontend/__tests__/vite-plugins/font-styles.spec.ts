import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vite-plus/test";
import type { ResolvedConfig } from "vite";

import { Fonts } from "../../src/ts/constants/fonts";
import { fontStyles } from "../../vite-plugins/font-styles";

async function generate(): Promise<{
  css: Map<string, string>;
  files: string[];
}> {
  const plugin = fontStyles();
  const config = plugin.config;
  const resolved = plugin.configResolved;
  if (typeof config !== "function" || typeof resolved !== "function") {
    throw new Error("Missing config hooks");
  }
  const result = await config.call(
    {} as never,
    {},
    {
      command: "serve",
      mode: "development",
    },
  );
  await resolved.call({} as never, {} as ResolvedConfig);
  const aliases = result?.resolve?.alias;
  if (aliases === undefined || Array.isArray(aliases)) {
    throw new Error("Missing CSS aliases");
  }
  const files = Object.values(aliases);
  return {
    files,
    css: new Map(
      files.map((file) => [path.basename(file), readFileSync(file, "utf8")]),
    ),
  };
}

it("preserves font families, weights, and preview URLs", async () => {
  const css = (await generate()).css.get("fonts.css") ?? "";
  const faces = new Map(
    [...css.matchAll(/@font-face\s*{([^}]+)}/g)].map((match) => [
      match[1]?.match(/font-family: "([^"]+)"/)?.[1],
      match[1] ?? "",
    ]),
  );
  expect(faces.has("Vazirharf")).toBe(true);
  for (const [name, font] of Object.entries(Fonts)) {
    const family = name.replaceAll("_", " ");
    if (font.systemFont) {
      expect(faces.has(family)).toBe(false);
      continue;
    }
    expect(faces.get(family)).toContain(`font-weight: ${font.weight ?? 400};`);
    expect(faces.get(family)).toContain(`url("/webfonts/${font.fileName}")`);
    expect(faces.get(`${family} Preview`)).toContain(
      `url("/webfonts/${font.fileName}")`,
    );
  }
});

it("serves the full icon fonts with every icon rule", async () => {
  const { css, files } = await generate();
  const fontawesome = css.get("fontawesome.css") ?? "";
  for (const file of [
    "fa-solid-900.woff2",
    "fa-regular-400.woff2",
    "fa-brands-400.woff2",
  ]) {
    expect(fontawesome).toContain(`webfonts/${file}`);
  }
  expect(fontawesome).not.toContain("url(../webfonts/");
  expect(fontawesome).toContain(".fa-keyboard");
  expect(fontawesome).toContain(".fa-arrow-up-from-water-pump");
  expect(files).toHaveLength(2);
});

it("imports the generated font faces from the Start app CSS", () => {
  const read = (file: string): string =>
    readFileSync(path.join(import.meta.dirname, "../../src", file), "utf8");
  expect(read("app/app.css")).toContain('@import "oxytype-fonts.css"');
  expect(read("styles/vendor.css")).toContain(
    '@import "oxytype-fontawesome.css"',
  );
});
