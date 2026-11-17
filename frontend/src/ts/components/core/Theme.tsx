import { Meta, MetaProvider, Style } from "@solidjs/meta";
import { createMemo, JSXElement } from "solid-js";

import { toThemeVars } from "../../../app/theme-vars";
import { Theme as ThemeColors, themes } from "../../constants/themes";
import { createEffectOn } from "../../hooks/effects";
import { useRef } from "../../hooks/useRef";
import { getTheme } from "../../states/theme";
import { FavIcon } from "./FavIcon";

// Read by the document theme bootstrap script to paint the last theme early.
const THEME_COLORS_KEY = "themeColors";
const BOOTSTRAP_STYLE_ID = "themeBootstrap";

// All 52 decorations total ~48 KB before compression. Keep them ready so a
// hover never waits for a stylesheet request or paints with the previous one.
const themeStyles = import.meta.glob<string>(
  "../../../../static/themes/*.css",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

function toCss(colors: ThemeColors): string {
  const vars = Object.entries(toThemeVars(colors))
    .map(([name, value]) => `    --${name}: ${value};`)
    .join("\n");
  return `\n:root {\n${vars}\n}`;
}

export function Theme(): JSXElement {
  // Refs are assigned by SolidJS via the ref attribute
  const [styleRef, styleEl] = useRef<HTMLStyleElement>();
  const applyColors = (colors: ThemeColors, persist: boolean) => {
    const style = styleEl();
    if (style) style.textContent = toCss(colors);
    if (!persist) return;
    // The startup palette loses to the real theme once config has applied it.
    document.getElementById(BOOTSTRAP_STYLE_ID)?.remove();
    try {
      localStorage.setItem(
        THEME_COLORS_KEY,
        JSON.stringify(toThemeVars(colors)),
      );
    } catch {
      // storage may be full or unavailable
    }
  };
  createEffectOn(getTheme, (colors, previous) => {
    applyColors(colors, previous !== undefined);
  });

  const decoration = createMemo(() => {
    const name = getTheme().name;
    return name !== "custom" && themes[name]?.hasCss
      ? (themeStyles[`../../../../static/themes/${name}.css`] ?? "")
      : "";
  });

  return (
    <MetaProvider>
      <Style id="theme" ref={styleRef} />
      <Style id="currentTheme">{decoration()}</Style>
      <Meta id="metaThemeColor" name="theme-color" content={getTheme().bg} />
      <FavIcon theme={getTheme()} />
    </MetaProvider>
  );
}
