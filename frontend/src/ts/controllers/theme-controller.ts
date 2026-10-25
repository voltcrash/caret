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
import { debounce } from "@oxytype/util/timing";
import { untrack } from "solid-js";
import { CustomThemeColors, ThemeName } from "@oxytype/schemas/configs";
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

export let randomTheme: ThemeIdentifier | null = null;
let isPreviewingTheme = false;
let randomThemeIndex = 0;

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
  if (randomTheme !== null) str = randomTheme;

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
  const currentTheme = nameOverride ?? randomTheme ?? getMutableConfig().theme;
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

let previewState: PreviewState = null;

export function preview(
  themeIdentifier: ThemeIdentifier,
  customColorsOverride?: CustomThemeColors,
): void {
  previewState = { theme: themeIdentifier, colors: customColorsOverride };
  debouncedPreview();
}

const debouncedPreview = debounce(250, () => {
  if (previewState) {
    isPreviewingTheme = true;
    void apply(previewState.theme, previewState.colors, true);
  }
});

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
  previewState = null;

  if (isPreviewingTheme) {
    isPreviewingTheme = false;
    if (applyTheme) {
      if (randomTheme !== null) {
        await apply(randomTheme);
      } else if (getMutableConfig().customTheme) {
        await apply("custom");
      } else {
        await apply(getMutableConfig().theme);
      }
    }
  }
}

let themesList: (ThemeName | string)[] = [];

async function changeThemeList(): Promise<void> {
  const themes = ThemesList;
  if (
    getMutableConfig().randomTheme === "fav" &&
    getMutableConfig().favThemes.length > 0
  ) {
    themesList = getMutableConfig().favThemes;
  } else if (getMutableConfig().randomTheme === "light") {
    themesList = themes.filter((t) => isColorLight(t.bg)).map((t) => t.name);
  } else if (getMutableConfig().randomTheme === "dark") {
    themesList = themes.filter((t) => isColorDark(t.bg)).map((t) => t.name);
  } else if (
    getMutableConfig().randomTheme === "on" ||
    getMutableConfig().randomTheme === "auto"
  ) {
    themesList = themes.map((t) => {
      return t.name;
    });
  } else if (getMutableConfig().randomTheme === "custom") {
    themesList = untrack(CustomThemes.getCustomThemes).map((ct) => ct._id);
  }
  Arrays.shuffle(themesList);
  randomThemeIndex = 0;
}

export async function randomizeTheme(): Promise<void> {
  if (themesList.length === 0) {
    await changeThemeList();
    if (themesList.length === 0) return;
  }

  let filter = (_: string): boolean => true;
  if (getMutableConfig().randomTheme === "auto") {
    filter = prefersColorSchemeDark() ? isColorDark : isColorLight;
  }

  let nextTheme = null;
  do {
    randomTheme = themesList[randomThemeIndex] as ThemeIdentifier;
    nextTheme = themes[themesList[randomThemeIndex] as ThemeName];
    randomThemeIndex++;
    if (randomThemeIndex >= themesList.length) {
      Arrays.shuffle(themesList);
      randomThemeIndex = 0;
    }
  } while (!filter(nextTheme.bg));

  let colorsOverride: CustomThemeColors | undefined;

  if (getMutableConfig().randomTheme === "custom") {
    const themeId = randomTheme;
    const theme = untrack(() => CustomThemes.getCustomTheme(themeId));
    colorsOverride = theme?.colors;
    randomTheme = "custom";
  }

  setConfig("customTheme", false, {
    nosave: true,
  });
  await apply(randomTheme, colorsOverride);

  if (randomThemeIndex >= themesList.length) {
    const themeId = randomTheme;
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
  if (randomTheme === null) return;
  randomTheme = null;
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
  const localBackgroundFile = await fileStorage.getFile("LocalBackgroundFile");
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

let ignoreConfigEvent = false;

function prefersColorSchemeDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

import.meta.hot?.dispose(() => debouncedPreview.cancel());

export function useThemeEvents(): void {
  configEvent.useListener(async ({ key, newValue, nosave }) => {
    if (key === "fullConfigChange") {
      ignoreConfigEvent = true;
    }
    if (key === "fullConfigChangeFinished") {
      ignoreConfigEvent = false;

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
    if (ignoreConfigEvent) return;

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
