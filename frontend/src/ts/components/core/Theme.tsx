import { Meta, MetaProvider, Style } from "@solidjs/meta";
import {
  createEffect,
  createMemo,
  createSignal,
  JSXElement,
  onCleanup,
  untrack,
} from "solid-js";

import { toThemeVars } from "#app/theme-vars.ts";

import type { Theme as ThemeColors } from "../../constants/themes";

import { createEffectOn } from "../../hooks/effects";
import { useRef } from "../../hooks/useRef";
import { getTheme } from "../../states/theme";
import { FavIcon } from "./FavIcon";

// Read by the document theme bootstrap script to paint the last theme early.
const THEME_COLORS_KEY = "themeColors";
const BOOTSTRAP_STYLE_ID = "themeBootstrap";

type DecorationLookup = (name: string) => string;

function toCss(colors: ThemeColors): string {
  const vars = Object.entries(toThemeVars(colors))
    .map(([name, value]) => `    --${name}: ${value};`)
    .join("\n");
  return `\n:root {\n${vars}\n}`;
}

export function Theme(): JSXElement {
  // Refs are assigned by SolidJS via the ref attribute
  const [styleRef, styleEl] = useRef<HTMLStyleElement>();
  const [decorationLookup, setDecorationLookup] =
    createSignal<DecorationLookup>();
  // Browser chrome and the reload palette follow selection, not hover.
  const committedTheme = createMemo<ReturnType<typeof getTheme>>(
    (previous) => (getTheme().preview ? previous : getTheme()),
    untrack(getTheme),
  );
  const applyColors = (
    colors: ReturnType<typeof getTheme>,
    applied: boolean,
  ) => {
    const style = styleEl();
    if (style) style.textContent = toCss(colors);
    if (!applied) return;
    // The startup palette loses to the real theme once config has applied it.
    document.getElementById(BOOTSTRAP_STYLE_ID)?.remove();
    if (colors.preview) return;
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

  const mayHaveDecoration = (current: ReturnType<typeof getTheme>): boolean =>
    current.name !== "custom" &&
    current.name !== "azure" &&
    current.hasCss !== false;

  createEffect(() => {
    const current = getTheme();
    if (!mayHaveDecoration(current) || decorationLookup() !== undefined) {
      return;
    }
    let disposed = false;
    onCleanup(() => {
      disposed = true;
    });
    void import("../../constants/theme-decorations")
      .then((module) => {
        if (!disposed) setDecorationLookup(() => module.getThemeDecoration);
      })
      .catch(() => undefined);
  });

  const decoration = createMemo(() => {
    const current = getTheme();
    if (!mayHaveDecoration(current)) return "";
    return decorationLookup()?.(current.name) ?? "";
  });

  return (
    <MetaProvider>
      <Style id="theme" ref={styleRef} />
      <Style id="currentTheme">{decoration()}</Style>
      <Meta
        id="metaThemeColor"
        name="theme-color"
        content={committedTheme().bg}
      />
      <FavIcon theme={committedTheme()} />
    </MetaProvider>
  );
}
