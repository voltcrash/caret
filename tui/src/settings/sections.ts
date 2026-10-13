import type { Config } from "@oxytype/schemas/configs";

import type { Command } from "../palette/types";
import {
  ThemesList,
  convertThemeToCustomColors,
  themes,
} from "@oxytype/typing-core/themes";
import { openCommand, configRow, settingTitle } from "./rows";
import { LanguageSchema } from "@oxytype/schemas/languages";
import { get as getTypingSpeedUnit } from "@oxytype/typing-core/typing-speed-units";

import type { Account } from "../account";
import type { SettingRow, SettingSection, RowContext } from "./rows";

export type SectionContext = RowContext & {
  loggedIn: () => boolean;
  account?: Account;
  tools?: Command[];
};

function speed(context: RowContext, key: keyof Config): () => string {
  return () => {
    const unit = context.store.config.typingSpeedUnit;
    const value = getTypingSpeedUnit(unit).fromWpm(
      Number(context.store.config[key]),
    );
    return `${Math.round(value * 100) / 100} ${unit}`;
  };
}

function toWpm(context: RowContext): (input: string) => number {
  return (input) =>
    getTypingSpeedUnit(context.store.config.typingSpeedUnit).toWpm(
      Number(input),
    );
}

function replaceUnderscores(value: unknown): string {
  return String(value).replace(/_/g, " ");
}

function behaviorSection(context: SectionContext): SettingSection {
  const { store } = context;
  return {
    id: "behavior",
    title: "behavior",
    groups: [
      {
        title: "saved tests",
        available: context.loggedIn,
        rows: [configRow(context, "resultSaving")],
      },
      {
        title: "test behavior",
        rows: [
          configRow(context, "difficulty"),
          configRow(context, "quickRestart"),
          configRow(context, "repeatQuotes"),
          configRow(context, "blindMode"),
          configRow(context, "alwaysShowWordsHistory"),
          configRow(context, "singleListCommandLine"),
          {
            ...configRow(context, "commandPaletteHotkey"),
            value: () => `${store.config.commandPaletteHotkey} · terminal ^p`,
            activate: undefined,
            note: "web only",
          },
        ],
      },
      {
        title: "speed & accuracy",
        rows: [
          configRow(context, "minWpm", {
            options: ["off", "custom"],
            detail: speed(context, "minWpmCustomSpeed"),
            resetKeys: ["minWpmCustomSpeed", "minWpm"],
            input: {
              value: "custom",
              secondKey: "minWpmCustomSpeed",
              convert: toWpm(context),
              defaultValue: () =>
                speed(context, "minWpmCustomSpeed")().split(" ")[0] ?? "",
            },
          }),
          configRow(context, "minAcc", {
            options: ["off", "custom"],
            detail: () => `${store.config.minAccCustom}%`,
            resetKeys: ["minAccCustom", "minAcc"],
            input: {
              value: "custom",
              secondKey: "minAccCustom",
              convert: Number,
            },
          }),
          configRow(context, "minBurst", {
            detail: speed(context, "minBurstCustomSpeed"),
            resetKeys: ["minBurstCustomSpeed", "minBurst"],
            input: {
              display: "min word burst speed",
              secondKey: "minBurstCustomSpeed",
              convert: toWpm(context),
              defaultValue: () =>
                speed(context, "minBurstCustomSpeed")().split(" ")[0] ?? "",
            },
          }),
        ],
      },
      {
        title: "language",
        rows: [
          configRow(context, "language", {
            options: LanguageSchema.options,
            optionDisplay: replaceUnderscores,
          }),
          configRow(context, "britishEnglish"),
        ],
      },
      {
        title: "funbox",
        rows: [
          configRow(context, "customLayoutfluid", {
            input: {
              defaultValue: () => store.config.customLayoutfluid.join(" "),
              convert: (value) => value.split(/\s+/).filter(Boolean),
            },
          }),
          configRow(context, "customPolyglot", {
            input: {
              defaultValue: () => store.config.customPolyglot.join(" "),
              convert: (value) => value.split(/\s+/).filter(Boolean),
            },
          }),
        ],
      },
    ],
  };
}

function inputSection(context: SectionContext): SettingSection {
  return {
    id: "input",
    title: "input",
    groups: [
      {
        title: "editing",
        rows: [
          configRow(context, "freedomMode"),
          configRow(context, "strictSpace"),
          configRow(context, "confidenceMode"),
          configRow(context, "codeUnindentOnBackspace"),
        ],
      },
      {
        title: "errors & corrections",
        rows: [
          configRow(context, "stopOnError"),
          configRow(context, "deleteOnError", {
            optionDisplay: replaceUnderscores,
          }),
          configRow(context, "quickEnd"),
          configRow(context, "indicateTypos"),
          configRow(context, "hideExtraLetters"),
        ],
      },
      {
        title: "keyboard & composition",
        rows: [
          configRow(context, "layout", {
            optionDisplay: (layout) =>
              layout === "default" ? "off" : replaceUnderscores(layout),
          }),
          configRow(context, "oppositeShiftMode"),
          configRow(context, "compositionDisplay"),
          configRow(context, "lazyMode"),
        ],
      },
    ],
  };
}

function soundSection(context: SectionContext): SettingSection {
  return {
    id: "sound",
    title: "sound",
    groups: [
      {
        title: "sound effects",
        rows: [
          configRow(context, "soundVolume", {
            options: [0.1, 0.5, 1],
            optionDisplay: (value) =>
              ({ 0.1: "quiet", 0.5: "medium", 1: "loud" })[value] ??
              String(value),
            input: { convert: Number },
          }),
          configRow(context, "playSoundOnClick"),
          configRow(context, "playSoundOnError"),
          configRow(context, "playTimeWarning"),
        ],
      },
    ],
  };
}

function caretSection(context: SectionContext): SettingSection {
  return {
    id: "caret",
    title: "caret",
    groups: [
      {
        title: "typing caret",
        rows: [
          configRow(context, "smoothCaret"),
          configRow(context, "caretStyle"),
        ],
      },
      {
        title: "pace caret",
        rows: [
          configRow(context, "paceCaret", {
            inlineMax: 7,
            options: [
              "off",
              "average",
              "pb",
              "tagPb",
              "last",
              "daily",
              "custom",
            ],
            detail: () =>
              context.store.config.paceCaret === "custom"
                ? speed(context, "paceCaretCustomSpeed")()
                : undefined,
            resetKeys: ["paceCaretCustomSpeed", "paceCaret"],
            input: {
              value: "custom",
              secondKey: "paceCaretCustomSpeed",
              convert: toWpm(context),
              defaultValue: () =>
                speed(context, "paceCaretCustomSpeed")().split(" ")[0] ?? "",
            },
          }),
          configRow(context, "repeatedPace"),
          configRow(context, "paceCaretStyle"),
        ],
      },
    ],
  };
}

function appearanceSection(context: SectionContext): SettingSection {
  const { store } = context;
  return {
    id: "appearance",
    title: "appearance",
    groups: [
      {
        title: "timer",
        rows: [
          configRow(context, "timerStyle", {
            optionDisplay: replaceUnderscores,
          }),
          configRow(context, "timerColor"),
          configRow(context, "timerOpacity"),
        ],
      },
      {
        title: "speed",
        rows: [
          configRow(context, "liveSpeedStyle"),
          configRow(context, "liveAccStyle"),
          configRow(context, "liveBurstStyle"),
          configRow(context, "typingSpeedUnit", {
            options: ["wpm", "cpm", "wps", "cps"],
          }),
        ],
      },
      {
        title: "stats",
        rows: [
          configRow(context, "alwaysShowDecimalPlaces"),
          configRow(context, "startGraphsAtZero"),
        ],
      },
      {
        title: "text",
        rows: [
          configRow(context, "fontSize", { input: { convert: Number } }),
          configRow(context, "fontFamily"),
          configRow(context, "highlightMode", {
            optionDisplay: replaceUnderscores,
          }),
          configRow(context, "typedEffect"),
        ],
      },
      {
        title: "layout",
        rows: [
          configRow(context, "tapeMode"),
          configRow(context, "tapeMargin", {
            input: { convert: Number },
            value: () => `${store.config.tapeMargin}%`,
          }),
          configRow(context, "smoothLineScroll"),
          configRow(context, "showAllLines"),
          configRow(context, "maxLineWidth", { input: { convert: Number } }),
        ],
      },
      {
        title: "keymap",
        rows: [
          configRow(context, "keymapMode"),
          configRow(context, "keymapLayout", {
            available: () => store.config.keymapMode !== "off",
            optionDisplay: (layout) =>
              layout === "overrideSync"
                ? "emulator sync"
                : replaceUnderscores(layout),
          }),
          configRow(context, "keymapStyle", {
            available: () => store.config.keymapMode !== "off",
            optionDisplay: replaceUnderscores,
          }),
          configRow(context, "keymapLegendStyle", {
            available: () => store.config.keymapMode !== "off",
          }),
          configRow(context, "keymapKeys", {
            available: () => store.config.keymapMode !== "off",
            optionDisplay: replaceUnderscores,
          }),
          configRow(context, "keymapSize", {
            available: () => store.config.keymapMode !== "off",
            input: { convert: Number },
          }),
        ],
      },
    ],
  };
}

function hideElementsSection(context: SectionContext): SettingSection {
  return {
    id: "hideElements",
    title: "hide elements",
    groups: [
      {
        title: "interface visibility",
        rows: [
          configRow(context, "showKeyTips"),
          configRow(context, "showOutOfFocusWarning"),
          configRow(context, "showTestModesNotice"),
          configRow(context, "capsLockWarning"),
          configRow(context, "showAverage"),
          configRow(context, "showPb"),
        ],
      },
    ],
  };
}

function themeSection(context: SectionContext): SettingSection {
  const { store } = context;
  const colorNames = [
    "background",
    "main",
    "caret",
    "sub",
    "sub alternate",
    "text",
    "error",
    "extra error",
    "colorful error",
    "colorful extra error",
  ];
  return {
    id: "theme",
    title: "theme",
    groups: [
      {
        title: "theme",
        rows: [
          configRow(context, "theme", {
            options: ThemesList.map((it) => it.name),
            optionDisplay: replaceUnderscores,
          }),
          {
            id: "favoriteTheme",
            title: "favorite current theme",
            value: () =>
              store.config.favThemes.includes(store.config.theme)
                ? "yes"
                : "no",
            activate: () => {
              const favorites = store.config.favThemes;
              store.set(
                "favThemes",
                favorites.includes(store.config.theme)
                  ? favorites.filter((it) => it !== store.config.theme)
                  : [...favorites, store.config.theme],
              );
            },
          },
          configRow(context, "randomTheme", {
            options: ["off", "on", "fav", "light", "dark"],
            note: "auto/custom rotation: web only",
          }),
          configRow(context, "autoSwitchTheme", { note: "web only" }),
          configRow(context, "themeLight", {
            optionDisplay: replaceUnderscores,
            note: "web only",
          }),
          configRow(context, "themeDark", {
            optionDisplay: replaceUnderscores,
            note: "web only",
          }),
          configRow(context, "flipTestColors"),
          configRow(context, "colorfulMode"),
        ],
      },
      {
        title: "custom colors",
        rows: [
          configRow(context, "customTheme"),
          {
            id: "copyPresetTheme",
            title: "copy preset colors",
            activate: () => {
              store.set(
                "customThemeColors",
                convertThemeToCustomColors(themes[store.config.theme]),
              );
              store.set("customTheme", true);
            },
          },
          ...colorNames.map((name, index): SettingRow => ({
            id: `customColor${index}`,
            title: name,
            value: () => store.config.customThemeColors[index],
            activate: () =>
              openCommand(context, {
                id: `editColor${index}`,
                display: `Custom ${name}`,
                input: {
                  defaultValue: () =>
                    store.config.customThemeColors[index] ?? "",
                  submit: (value) => {
                    const colors = [
                      ...store.config.customThemeColors,
                    ] as Config["customThemeColors"];
                    colors[index] = value.trim();
                    if (!store.set("customThemeColors", colors)) {
                      return "Enter a hex color (#rgb or #rrggbb, optional alpha)";
                    }
                    store.set("customTheme", true);
                    return undefined;
                  },
                },
              }),
          })),
        ],
      },
      {
        title: "background",
        rows: [
          configRow(context, "customBackground"),
          configRow(context, "customBackgroundSize"),
        ],
      },
    ],
  };
}

function dangerSection(context: SectionContext): SettingSection {
  return {
    id: "danger",
    title: "danger zone",
    groups: [
      {
        title: "configuration",
        rows: (context.tools ?? []).map((command) => ({
          id: command.id,
          title: command.display.replace(/\.\.\.$/, "").toLowerCase(),
          activate: () => openCommand(context, command),
        })),
      },
    ],
  };
}

/** Settings sections in the web's order. */
export function settingSections(context: SectionContext): SettingSection[] {
  return [
    behaviorSection(context),
    inputSection(context),
    soundSection(context),
    caretSection(context),
    appearanceSection(context),
    hideElementsSection(context),
    themeSection(context),
    dangerSection(context),
  ];
}

export { settingTitle };
