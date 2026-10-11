import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, URL as NodeURL } from "node:url";
import type { Plugin } from "vite";

import { Fonts } from "../src/ts/constants/fonts";

/**
 * Drops `.fa-name { --fa: "..." }` rules for icons missing from the subset
 * font; they could never render a glyph anyway.
 */
export function pruneIconRules(css: string, used: Set<string>): string {
  return css.replace(
    /((?:\.fa-[a-z0-9-]+,\s*)*\.fa-[a-z0-9-]+)\s*\{\s*--fa:\s*"[^"]*";\s*\}\s*/g,
    (rule, selectors: string) =>
      selectors
        .split(",")
        .some((selector) => used.has(selector.trim().slice(".fa-".length)))
        ? rule
        : "",
  );
}

// Real CSS files let Tailwind resolve these imports without a Sass preprocessor.
// Separate directories keep development and production servers independent.
export function fontStyles(options: { isDevelopment: boolean }): Plugin {
  const output = path.join(
    fileURLToPath(new NodeURL("..", import.meta.url)),
    "src/styles/generated",
    options.isDevelopment ? "development" : "production",
  );
  const imports = {
    "oxytype-fonts.css": path.join(output, "fonts.css"),
    "oxytype-fontawesome.css": path.join(output, "fontawesome.css"),
  };
  return {
    name: "oxytype-font-styles",
    config() {
      return { resolve: { alias: imports } };
    },
    async configResolved() {
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
          face(
            `${family} Preview`,
            `/${options.isDevelopment ? "webfonts" : "webfonts-preview"}/${font.fileName}`,
            font.weight,
          ),
        );
      }
      writeFileSync(imports["oxytype-fonts.css"], faces.join("\n"));

      const require = createRequire(import.meta.url);
      const styles = ["fontawesome", "solid", "regular", "brands"].map(
        (name) => {
          const file = require.resolve(
            `@fortawesome/fontawesome-free/css/${name}.css`,
          );
          const fonts = options.isDevelopment
            ? `${path.relative(output, path.resolve(path.dirname(file), "../webfonts")).replaceAll(path.sep, "/")}/`
            : "/webfonts-generated/";
          return readFileSync(file, "utf8").replaceAll("../webfonts/", fonts);
        },
      );
      let fontawesome = styles.join("\n");
      if (!options.isDevelopment) {
        const { getFontawesomeConfig } = await import("./fontawesome-subset");
        const { solid, regular, brands } = getFontawesomeConfig();
        fontawesome = pruneIconRules(
          fontawesome,
          new Set([...solid, ...regular, ...brands]),
        );
      }
      writeFileSync(imports["oxytype-fontawesome.css"], fontawesome);
    },
  };
}
