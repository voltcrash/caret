import {
  setBackground,
  setBackgroundStyle,
  setBackgroundSize,
} from "../states/background";
import * as Arrays from "../utils/arrays";
import { isColorDark, isColorLight } from "../utils/colors";

import { peekConfig, getConfig } from "../config/store";
import { setConfig } from "../config/setters";
import { configEvent } from "../events/config";
import * as CustomThemes from "../states/custom-themes";
import { showNoticeNotification } from "../states/notifications";
import { onCleanup, untrack } from "solid-js";
import { createAppOwned } from "../../app/application";
import { appObject } from "../../app/state";
import type { CustomThemeColors, ThemeName } from "@caret/schemas/configs";
import type { Theme, ThemeWithName } from "../constants/themes";
import fileStorage from "../utils/file-storage";
import { setThemeIndicator } from "../states/core";
import { setTheme, ThemeIdentifier } from "../states/theme";

const azureTheme: Theme = {
  bg: "#0b0d1c",
  main: "#4ea8ff",
  caret: "#4ea8ff",
  sub: "#8290b4",
  subAlt: "#151a30",
  text: "#e4ebff",
  error: "#ff6b5e",
  errorExtra: "#b8423a",
  colorfulError: "#ff6b5e",
  colorfulErrorExtra: "#b8423a",
};

export function convertCustomColorsToTheme(colors: CustomThemeColors): Theme {
  return {
    bg: colors[0],
    main: colors[1],
    caret: colors[2],
    sub: colors[3],
    subAlt: colors[4],
    text: colors[5],
    error: colors[6],
    errorExtra: colors[7],
    colorfulError: colors[8],
    colorfulErrorExtra: colors[9],
  };
}

export function convertThemeToCustomColors(theme: Theme): CustomThemeColors {
  return [
    theme.bg,
    theme.main,
    theme.caret,
    theme.sub,
    theme.subAlt,
    theme.text,
    theme.error,
    theme.errorExtra,
    theme.colorfulError,
    theme.colorfulErrorExtra,
  ];
}

type ThemeCatalog = {
  themes: Record<ThemeName, Theme>;
  ThemesList: ThemeWithName[];
};

const themeState = createAppOwned(() => {
  const value = {
    randomTheme: null as ThemeIdentifier | null,
    randomThemeIndex: 0,
    preview: { phase: "idle" } as PreviewState,
    themesList: [] as string[],
    catalog: undefined as ThemeCatalog | undefined,
    ignoreConfigEvent: false,
    backgroundRevision: 0,
    disposed: false,
  };
  onCleanup(() => {
    value.disposed = true;
    if (value.preview.phase === "queued") {
      cancelAnimationFrame(value.preview.frame);
    }
  });
  return value;
});
const state = appObject(themeState);
export const getRandomTheme = (): ThemeIdentifier | null => state.randomTheme;

async function loadThemeCatalog(): Promise<ThemeCatalog> {
  const current = themeState();
  if (current.catalog !== undefined) return current.catalog;
  const loaded = await import("../constants/themes");
  current.catalog = { themes: loaded.themes, ThemesList: loaded.ThemesList };
  return current.catalog;
}

async function apply(
  themeName: ThemeIdentifier,
  customColorsOverride?: CustomThemeColors,
  isPreview = false,
): Promise<void> {
  console.debug(`Theme controller applying theme ${themeName}`, {
    customColorsOverride,
    isPreview,
  });

  const isCustom = themeName === "custom";

  let themeColors: Theme;
  if (isCustom) {
    themeColors = convertCustomColorsToTheme(
      customColorsOverride ?? peekConfig().customThemeColors,
    );
  } else if (themeName === "azure") {
    themeColors = azureTheme;
  } else {
    const catalog = await loadThemeCatalog();
    if (themeState().disposed) return;
    themeColors = catalog.themes[themeName];
  }

  setTheme({ ...themeColors, name: themeName, preview: isPreview });

  updateThemeIndicator(isPreview ? themeName : undefined);
}

function updateThemeIndicator(nameOverride?: string): void {
  //text
  let str: string = peekConfig().theme;
  if (state.randomTheme !== null) str = state.randomTheme;

  if (peekConfig().customTheme && nameOverride === undefined) {
    // Match current custom theme by colors since Config does not store custom theme IDs
    const matchedTheme = untrack(CustomThemes.getCustomThemes).find((ct) =>
      Arrays.areSortedArraysEqual(ct.colors, peekConfig().customThemeColors),
    );

    if (matchedTheme) {
      str = `${matchedTheme.name} (custom)`;
    } else {
      str = "custom";
    }
  }

  if (nameOverride !== undefined && nameOverride !== "") str = nameOverride;
  str = str.replace(/_/g, " ");

  //fav icon
  const currentTheme = nameOverride ?? state.randomTheme ?? peekConfig().theme;
  const isFavorite =
    !peekConfig().customTheme &&
    currentTheme !== null &&
    peekConfig().favThemes.includes(currentTheme as ThemeName);

  setThemeIndicator({ text: str, isFavorite });
}

type PreviewState =
  | { phase: "idle" | "applied" }
  | {
      phase: "queued";
      frame: number;
      restore: boolean;
      theme: ThemeIdentifier;
      colors?: CustomThemeColors;
    };

export function preview(
  theme: ThemeIdentifier,
  colors?: CustomThemeColors,
): void {
  const current = themeState();
  const previous = current.preview;
  if (previous.phase === "queued") {
    previous.theme = theme;
    previous.colors = colors;
    return;
  }
  const frame = requestAnimationFrame(() => {
    const queued = current.preview;
    if (current.disposed || queued.phase !== "queued") return;
    current.preview = { phase: "applied" };
    void apply(queued.theme, queued.colors, true);
  });
  current.preview = {
    phase: "queued",
    frame,
    theme,
    colors,
    restore: previous.phase === "applied",
  };
}

async function set(
  themeIdentifier: ThemeIdentifier,
  isAutoSwitch = false,
): Promise<void> {
  console.debug("Theme controller setting theme", themeIdentifier, {
    isAutoSwitch,
  });
  await apply(themeIdentifier);
  if (isAutoSwitch) updateThemeIndicator(themeIdentifier);

  if (!isAutoSwitch && peekConfig().autoSwitchTheme) {
    setConfig("autoSwitchTheme", false);
    showNoticeNotification("Auto switch theme disabled");
  }
}

export async function clearPreview(applyTheme = true): Promise<void> {
  const previous = state.preview;
  if (previous.phase === "queued") cancelAnimationFrame(previous.frame);
  state.preview = { phase: "idle" };
  if (
    applyTheme &&
    (previous.phase === "applied" ||
      (previous.phase === "queued" && previous.restore))
  ) {
    if (state.randomTheme !== null) {
      await apply(state.randomTheme);
    } else if (peekConfig().customTheme) {
      await apply("custom");
    } else {
      await apply(peekConfig().theme);
    }
  }
}

async function changeThemeList(): Promise<void> {
  const { ThemesList: themes } = await loadThemeCatalog();
  if (themeState().disposed) return;
  if (peekConfig().randomTheme === "fav" && peekConfig().favThemes.length > 0) {
    state.themesList = peekConfig().favThemes;
  } else if (peekConfig().randomTheme === "light") {
    state.themesList = themes
      .filter((t) => isColorLight(t.bg))
      .map((t) => t.name);
  } else if (peekConfig().randomTheme === "dark") {
    state.themesList = themes
      .filter((t) => isColorDark(t.bg))
      .map((t) => t.name);
  } else if (
    peekConfig().randomTheme === "on" ||
    peekConfig().randomTheme === "auto"
  ) {
    state.themesList = themes.map((t) => {
      return t.name;
    });
  } else if (peekConfig().randomTheme === "custom") {
    state.themesList = untrack(CustomThemes.getCustomThemes).map(
      (ct) => ct._id,
    );
  }
  Arrays.shuffle(state.themesList);
  state.randomThemeIndex = 0;
}

export async function randomizeTheme(): Promise<void> {
  const { themes } = await loadThemeCatalog();
  if (themeState().disposed) return;
  if (state.themesList.length === 0) {
    await changeThemeList();
    if (state.themesList.length === 0) return;
  }

  let filter = (_: string): boolean => true;
  if (peekConfig().randomTheme === "auto") {
    filter = prefersColorSchemeDark() ? isColorDark : isColorLight;
  }

  let nextTheme = null;
  do {
    state.randomTheme = state.themesList[
      state.randomThemeIndex
    ] as ThemeIdentifier;
    nextTheme = themes[state.themesList[state.randomThemeIndex] as ThemeName];
    state.randomThemeIndex++;
    if (state.randomThemeIndex >= state.themesList.length) {
      Arrays.shuffle(state.themesList);
      state.randomThemeIndex = 0;
    }
  } while (
    peekConfig().randomTheme !== "custom" &&
    nextTheme !== undefined &&
    !filter(nextTheme.bg)
  );

  let colorsOverride: CustomThemeColors | undefined;

  if (peekConfig().randomTheme === "custom") {
    const themeId = state.randomTheme;
    const theme = untrack(() => CustomThemes.getCustomTheme(themeId));
    colorsOverride = theme?.colors;
    state.randomTheme = "custom";
  }

  setConfig("customTheme", false, {
    nosave: true,
  });
  await apply(state.randomTheme, colorsOverride);

  if (state.randomThemeIndex >= state.themesList.length) {
    const themeId = state.randomTheme;
    let name = themeId.replace(/_/g, " ");
    if (peekConfig().randomTheme === "custom") {
      name = (
        untrack(() => CustomThemes.getCustomTheme(themeId))?.name ?? "custom"
      ).replace(/_/g, " ");
    }
    showNoticeNotification(name);
  }
}

async function clearRandom(): Promise<void> {
  if (state.randomTheme === null) return;
  state.randomTheme = null;
  if (peekConfig().customTheme) {
    await apply("custom");
  } else {
    await apply(peekConfig().theme);
  }
}

function applyCustomBackgroundSize(): void {
  const size = peekConfig().customBackgroundSize;
  setBackgroundSize(size === "max" ? "" : size);
}

export async function applyCustomBackground(): Promise<void> {
  const current = themeState();
  const revision = ++current.backgroundRevision;
  const localBackgroundFile = await fileStorage.getFile("LocalBackgroundFile");
  if (revision !== current.backgroundRevision || current.disposed) return;
  const url = localBackgroundFile ?? peekConfig().customBackground;
  setBackground({ url });
  if (url !== "") {
    applyCustomBackgroundFilters();
    applyCustomBackgroundSize();
  }
}

export function applyCustomBackgroundFilters(
  values?: [number, number, number, number],
): void {
  const valuesToApply = values ?? getConfig.customBackgroundFilter;

  let filterCSS = "";
  //blur
  if (valuesToApply[0] !== 0) {
    filterCSS += `blur(${valuesToApply[0]}rem) `;
  }
  //brightness
  if (valuesToApply[1] !== 1) {
    filterCSS += `brightness(${valuesToApply[1]}) `;
  }
  //saturate
  if (valuesToApply[2] !== 1) {
    filterCSS += `saturate(${valuesToApply[2]}) `;
  }
  //opacity
  if (valuesToApply[3] !== 1) {
    filterCSS += `opacity(${valuesToApply[3]}) `;
  }

  const css = {
    filter: filterCSS,
    width: `calc(100% + ${valuesToApply[0] * 8}rem)`,
    height: `calc(100% + ${valuesToApply[0] * 8}rem)`,
    transform: `scale(${1 + valuesToApply[0] / 100})`,
    top: `-${valuesToApply[0] * 4}rem`,
    position: "absolute" as const,
  };
  setBackgroundStyle(css);
}

export function handleColorSchemeChange(event: MediaQueryListEvent): void {
  if (!peekConfig().autoSwitchTheme || peekConfig().customTheme) {
    return;
  }
  void set(
    event.matches ? peekConfig().themeDark : peekConfig().themeLight,
    true,
  );
}

function prefersColorSchemeDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export function useThemeEvents(): void {
  configEvent.useListener(async ({ key, newValue, nosave }) => {
    if (key === "fullConfigChange") {
      state.ignoreConfigEvent = true;
    }
    if (key === "fullConfigChangeFinished") {
      state.ignoreConfigEvent = false;

      await clearRandom();
      await clearPreview(false);

      if (peekConfig().autoSwitchTheme) {
        if (prefersColorSchemeDark()) {
          await set(peekConfig().themeDark, true);
        } else {
          await set(peekConfig().themeLight, true);
        }
      } else {
        if (peekConfig().customTheme) {
          await set("custom");
        } else {
          await set(peekConfig().theme);
        }
      }
      await applyCustomBackground();
    }

    // this is here to prevent calling set / preview multiple times during a full config loading
    // once the full config is loaded, we can apply everything once
    if (state.ignoreConfigEvent) return;

    if (key === "randomTheme") {
      void changeThemeList();
    }
    if (key === "customTheme") {
      newValue ? await set("custom") : await set(peekConfig().theme);
    }
    if (key === "customThemeColors") {
      nosave ? preview("custom") : await set("custom");
    }
    if (key === "theme") {
      await clearRandom();
      await clearPreview(false);
      await set(newValue);
    }
    if (key === "randomTheme" && newValue === "off") await clearRandom();
    if (key === "customBackground") await applyCustomBackground();

    if (key === "customBackgroundSize") applyCustomBackgroundSize();
    if (key === "autoSwitchTheme") {
      if (newValue) {
        if (prefersColorSchemeDark()) {
          await set(peekConfig().themeDark, true);
        } else {
          await set(peekConfig().themeLight, true);
        }
      } else {
        await set(peekConfig().theme);
      }
    }
    if (
      key === "themeLight" &&
      peekConfig().autoSwitchTheme &&
      !prefersColorSchemeDark() &&
      !nosave
    ) {
      await set(peekConfig().themeLight, true);
    }
    if (
      key === "themeDark" &&
      peekConfig().autoSwitchTheme &&
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches &&
      !nosave
    ) {
      await set(peekConfig().themeDark, true);
    }
    if (
      [
        "theme",
        "customTheme",
        "customThemeColors",
        "randomTheme",
        "favThemes",
      ].includes(key)
    ) {
      updateThemeIndicator();
    }
  });
}
