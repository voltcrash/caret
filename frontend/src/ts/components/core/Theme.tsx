import { Link, Meta, MetaProvider, Style } from "@solidjs/meta";
import {
  createEffect,
  createMemo,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";
import { debounce } from "throttle-debounce";

import { Theme as ThemeColors, themes } from "../../constants/themes";
import { createEffectOn } from "../../hooks/effects";
import { useRef } from "../../hooks/useRef";
import { hideLoaderBar, showLoaderBar } from "../../states/loader-bar";
import { showNoticeNotification } from "../../states/notifications";
import { getTheme } from "../../states/theme";
import { FavIcon } from "./FavIcon";

// Read by the inline script in html/head.html to paint the last theme early.
const THEME_COLORS_KEY = "themeColors";
const BOOTSTRAP_STYLE_ID = "themeBootstrap";

function toVars(colors: ThemeColors): Record<string, string> {
  return {
    "bg-color": colors.bg,
    "main-color": colors.main,
    "caret-color": colors.caret,
    "sub-color": colors.sub,
    "sub-alt-color": colors.subAlt,
    "text-color": colors.text,
    "error-color": colors.error,
    "error-extra-color": colors.errorExtra,
    "colorful-error-color": colors.colorfulError,
    "colorful-error-extra-color": colors.colorfulErrorExtra,
  };
}

function toCss(colors: ThemeColors): string {
  const vars = Object.entries(toVars(colors))
    .map(([name, value]) => `    --${name}: ${value};`)
    .join("\n");
  return `\n:root {\n${vars}\n}`;
}

export function Theme(): JSXElement {
  // Refs are assigned by SolidJS via the ref attribute
  const [styleRef, styleEl] = useRef<HTMLStyleElement>();
  const [linkRef, linkEl] = useRef<HTMLLinkElement>();

  //Use memo to ignore signals without changes, needed for the css loading
  const getThemeName = createMemo(() => getTheme().name);

  const onLoad = (e: Event): void => {
    hideLoaderBar();
    const target = e.target as HTMLLinkElement;
    if (target.href !== "") {
      console.debug(
        `Theme component loaded style for theme ${target.dataset["name"]}`,
      );
    }
  };

  const onError = (e: Event): void => {
    hideLoaderBar();
    const target = e.target as HTMLLinkElement;
    const name = target.dataset["name"];
    console.debug("Theme component failed to load style", name, e);
    console.error(`Failed to load theme ${name}`, e);
    showNoticeNotification("Failed to load theme");
  };

  const applyColors = (colors: ThemeColors, persist: boolean) => {
    const style = styleEl();
    if (style) style.textContent = toCss(colors);
    if (!persist) return;
    // The startup palette loses to the real theme once config has applied it.
    document.getElementById(BOOTSTRAP_STYLE_ID)?.remove();
    try {
      localStorage.setItem(THEME_COLORS_KEY, JSON.stringify(toVars(colors)));
    } catch {
      // storage may be full or unavailable
    }
  };
  const debouncedApply = debounce(125, applyColors);
  onCleanup(() => debouncedApply.cancel());

  createEffectOn(getTheme, (colors, previous) => {
    // Theme switches apply immediately; rapid colour edits are debounced.
    if (previous === undefined || previous.name !== colors.name) {
      debouncedApply.cancel({ upcomingOnly: true });
      applyColors(colors, previous !== undefined);
    } else {
      debouncedApply(colors, true);
    }
  });

  const isThemeWithCss = () => {
    const name = getThemeName();
    return name !== "custom" && (themes[name]?.hasCss ?? false);
  };

  createEffect(() => {
    const name = getThemeName();
    const hasCss = isThemeWithCss();

    console.debug(
      `Theme component ${hasCss ? "loading style" : "removing style"} for theme ${name}`,
    );
    if (hasCss) {
      showLoaderBar();
    } else {
      hideLoaderBar();
    }
    linkEl()?.setAttribute("href", hasCss ? `/themes/${name}.css` : "");
  });

  return (
    <MetaProvider>
      <Style id="theme" ref={styleRef} />
      <Show when={isThemeWithCss()}>
        <Link
          ref={linkRef}
          rel="stylesheet"
          id="currentTheme"
          data-name={getTheme().name}
          onError={onError}
          onLoad={onLoad}
        />
      </Show>
      <Meta id="metaThemeColor" name="theme-color" content={getTheme().bg} />
      <FavIcon theme={getTheme()} />
    </MetaProvider>
  );
}
