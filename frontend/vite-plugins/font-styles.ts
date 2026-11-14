import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL as NodeURL } from "node:url";
import type { Plugin } from "vite";

import { writeIconData } from "./icon-data";

import { Fonts } from "../src/ts/constants/fonts";

function writeIfChanged(file: string, content: string): void {
  if (existsSync(file) && readFileSync(file, "utf8") === content) return;
  writeFileSync(file, content);
}

// Real CSS files let Tailwind resolve these imports without a Sass preprocessor.
// Start and Storybook share text fonts and the owned SVG icon subset.
export function fontStyles(): Plugin {
  const output = path.join(
    fileURLToPath(new NodeURL("..", import.meta.url)),
    "src/styles/generated",
  );
  const imports = {
    "caret-fonts.css": path.join(output, "fonts.css"),
  };
  return {
    name: "caret-font-styles",
    config() {
      return { resolve: { alias: imports } };
    },
    configResolved() {
      mkdirSync(output, { recursive: true });
      const face = (family: string, file: string, weight = 400): string => `
@font-face {
  font-family: ${JSON.stringify(family)};
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(${JSON.stringify(file)}) format("woff2");
}`;
      const faces = [face("Vazirharf", "/webfonts/Vazirharf-NL-Regular.woff2")];
      for (const [name, font] of Object.entries(Fonts).sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        if (font.systemFont) continue;
        const family = name.replaceAll("_", " ");
        faces.push(face(family, `/webfonts/${font.fileName}`, font.weight));
        faces.push(
          face(`${family} Preview`, `/webfonts/${font.fileName}`, font.weight),
        );
      }
      writeIfChanged(imports["caret-fonts.css"], faces.join("\n"));

      writeIconData();
    },
  };
}
