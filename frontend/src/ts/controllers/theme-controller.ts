import {
  setBackground,
  setBackgroundStyle,
  setBackgroundSize,
} from "../states/background";
import * as Arrays from "../utils/arrays";
import { isColorDark, isColorLight } from "../utils/colors";

import { getMutableConfig, getConfig } from "../config/store";
import { setConfig } from "../config/setters";
import { configEvent } from "../events/config";
import * as CustomThemes from "../states/custom-themes";
import { showNoticeNotification } from "../states/notifications";
import { debounce } from "@caret/util/timing";
import { onCleanup, untrack } from "solid-js";
import { createAppOwned } from "../../app/application";
import { appObject } from "../../app/state";
import { CustomThemeColors, ThemeName } from "@caret/schemas/configs";
import {
  convertCustomColorsToTheme,
  themes,
  ThemesList,
} from "../constants/themes";
import fileStorage from "../utils/file-storage";
import { setThemeIndicator } from "../states/core";
import { setTheme, ThemeIdentifier } from "../states/theme";

export {
  convertCustomColorsToTheme,
  convertThemeToCustomColors,
} from "../constants/themes";





const themeState = createAppOwned(() => {
  const value = {
    randomTheme: null as ThemeIdentifier | null, isPreviewingTheme: false,
    randomThemeIndex: 0, previewState: null as PreviewState,
    themesList: [] as string[], ignoreConfigEvent: false,
    backgroundRevision: 0, disposed: false,
  };
const preview = debounce(250, () => {
  if (previewState) {
    isPreviewingTheme = true;
    void apply(previewState.theme, previewState.colors, true);
  }
});
  onCleanup(() => { value.disposed = true; preview.cancel(); });
  return Object.assign(value, { preview });
});
const state = appObject(themeState);
export const getRandomTheme = (): ThemeIdentifier | null => state.randomTheme;

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

  const themeColors = isCustom
    ? convertCustomColorsToTheme(
        customColorsOverride ?? getMutableConfig().customThemeColors,
      )
    : themes[themeName];

  setTheme({ ...themeColors, name: themeName });

  updateThemeIndicator(isPreview ? themeName : undefined);
}

function updateThemeIndicator(nameOverride?: string): void {
  //text
  let str: string = getMutableConfig().theme;
  if (state.randomTheme !== null) str = state.randomTheme;

  if (getMutableConfig().customTheme && nameOverride === undefined) {
    // Match current custom theme by colors since Config does not store custom theme IDs
    const matchedTheme = untrack(CustomThemes.getCustomThemes).find((ct) =>
      Arrays.areSortedArraysEqual(
        ct.colors,
        getMutableConfig().customThemeColors,
      ),
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
  const currentTheme = nameOverride ?? state.randomTheme ?? getMutableConfig().theme;
  const isFavorite =
    !getMutableConfig().customTheme &&
    currentTheme !== null &&
    getMutableConfig().favThemes.includes(currentTheme as ThemeName);

  setThemeIndicator({ text: str, isFavorite });
}

type PreviewState = {
  theme: ThemeIdentifier;
  colors?: CustomThemeColors;
} | null;



export function preview(
  themeIdentifier: ThemeIdentifier,
  customColorsOverride?: CustomThemeColors,
): void {
  state.previewState = { theme: themeIdentifier, colors: customColorsOverride };
  themeState().preview();
}



async function set(
  themeIdentifier: ThemeIdentifier,
  isAutoSwitch = false,
): Promise<void> {
  console.debug("Theme controller setting theme", themeIdentifier, {
    isAutoSwitch,
  });
  await apply(themeIdentifier, undefined, isAutoSwitch);

  if (!isAutoSwitch && getMutableConfig().autoSwitchTheme) {
    setConfig("autoSwitchTheme", false);
    showNoticeNotification("Auto switch theme disabled");
  }
}

export async function clearPreview(applyTheme = true): Promise<void> {
  state.previewState = null;

  if (state.isPreviewingTheme) {
    state.isPreviewingTheme = false;
    if (applyTheme) {
      if (state.randomTheme !== null) {
        await apply(state.randomTheme);
      } else if (getMutableConfig().customTheme) {
        await apply("custom");
      } else {
        await apply(getMutableConfig().theme);
      }
    }
  }
}



async function changeThemeList(): Promise<void> {
  const themes = ThemesList;
  if (
    getMutableConfig().randomTheme === "fav" &&
    getMutableConfig().favThemes.length > 0
  ) {
    state.themesList = getMutableConfig().favThemes;
  } else if (getMutableConfig().randomTheme === "light") {
    state.themesList = themes.filter((t) => isColorLight(t.bg)).map((t) => t.name);
  } else if (getMutableConfig().randomTheme === "dark") {
    state.themesList = themes.filter((t) => isColorDark(t.bg)).map((t) => t.name);
  } else if (
    getMutableConfig().randomTheme === "on" ||
    getMutableConfig().randomTheme === "auto"
  ) {
    state.themesList = themes.map((t) => {
      return t.name;
    });
  } else if (getMutableConfig().randomTheme === "custom") {
    state.themesList = untrack(CustomThemes.getCustomThemes).map((ct) => ct._id);
  }
  Arrays.shuffle(state.themesList);
  state.randomThemeIndex = 0;
}

export async function randomizeTheme(): Promise<void> {
  if (state.themesList.length === 0) {
    await changeThemeList();
    if (state.themesList.length === 0) return;
  }

  let filter = (_: string): boolean => true;
  if (getMutableConfig().randomTheme === "auto") {
    filter = prefersColorSchemeDark() ? isColorDark : isColorLight;
  }

  let nextTheme = null;
  do {
    state.randomTheme = state.themesList[state.randomThemeIndex] as ThemeIdentifier;
    nextTheme = themes[state.themesList[state.randomThemeIndex] as ThemeName];
    state.randomThemeIndex++;
    if (state.randomThemeIndex >= state.themesList.length) {
      Arrays.shuffle(state.themesList);
      state.randomThemeIndex = 0;
    }
  } while (getMutableConfig().randomTheme !== "custom" && nextTheme !== undefined && !filter(nextTheme.bg));

  let colorsOverride: CustomThemeColors | undefined;

  if (getMutableConfig().randomTheme === "custom") {
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
    if (getMutableConfig().randomTheme === "custom") {
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
  if (getMutableConfig().customTheme) {
    await apply("custom");
  } else {
    await apply(getMutableConfig().theme);
  }
}

function applyCustomBackgroundSize(): void {
  const size = getMutableConfig().customBackgroundSize;
  setBackgroundSize(size === "max" ? "" : size);
}

export async function applyCustomBackground(): Promise<void> {
  const current = themeState();
  const revision = ++current.backgroundRevision;
  const localBackgroundFile = await fileStorage.getFile("LocalBackgroundFile");
  if (revision !== current.backgroundRevision || current.disposed) return;
  const url = localBackgroundFile ?? getMutableConfig().customBackground;
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
  if (!getMutableConfig().autoSwitchTheme || getMutableConfig().customTheme) {
    return;
  }
  void set(
    event.matches
      ? getMutableConfig().themeDark
      : getMutableConfig().themeLight,
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

      if (getMutableConfig().autoSwitchTheme) {
        if (prefersColorSchemeDark()) {
          await set(getMutableConfig().themeDark, true);
        } else {
          await set(getMutableConfig().themeLight, true);
        }
      } else {
        if (getMutableConfig().customTheme) {
          await set("custom");
        } else {
          await set(getMutableConfig().theme);
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
      newValue ? await set("custom") : await set(getMutableConfig().theme);
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
          await set(getMutableConfig().themeDark, true);
        } else {
          await set(getMutableConfig().themeLight, true);
        }
      } else {
        await set(getMutableConfig().theme);
      }
    }
    if (
      key === "themeLight" &&
      getMutableConfig().autoSwitchTheme &&
      !prefersColorSchemeDark() &&
      !nosave
    ) {
      await set(getMutableConfig().themeLight, true);
    }
    if (
      key === "themeDark" &&
      getMutableConfig().autoSwitchTheme &&
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches &&
      !nosave
    ) {
      await set(getMutableConfig().themeDark, true);
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
