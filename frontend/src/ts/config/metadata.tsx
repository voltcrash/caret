import * as ConfigSchemas from "@oxytype/schemas/configs";
import {
  getOptionLabel,
  getOptionSearchKeywords,
  getVisibleOptions,
  sharedConfigMetadata,
  type ConfigOptionMetadata,
} from "@oxytype/typing-core/config/metadata";
import { typedKeys } from "@oxytype/util/objects";
import { JSXElement, untrack } from "solid-js";

import * as CustomThemes from "../collections/custom-themes";
import {
  DEFAULT_COMMAND_PALETTE_HOTKEY,
  getCommandPaletteHotkeyError,
  normalizeCommandPaletteHotkey,
} from "../input/hotkeys/command-palette-hotkey";
import { isAuthenticated } from "../states/core";
import { showNoticeNotification } from "../states/notifications";
import { FaObject } from "../types/font-awesome";
import {
  commandlineOptionLabels,
  commandlineTitles,
} from "./commandline-labels";

export { getOptionLabel, getOptionSearchKeywords, getVisibleOptions };

type OptionMetadata = ConfigOptionMetadata & {
  fa?: FaObject;
  commandlineLabel?: string;
};

export type ConfigMetadata<K extends keyof ConfigSchemas.Config> = {
  /**
   * The config key that this metadata is for
   */
  key: K;

  /**
   * Optional display string for the config key.
   */
  displayString?: string;
  commandline?: { title?: string; inputTitle?: string };
  /**
   * Should the config change trigger a resize event? handled in ui.ts:108
   */
  triggerResize?: true;

  description?: string | JSXElement;

  /**
   * Fa object (icon)
   */
  fa: FaObject;

  optionsMetadata?: ConfigSchemas.Config[K] extends string | number | symbol
    ? Record<ConfigSchemas.Config[K], OptionMetadata>
    : ConfigSchemas.Config[K] extends boolean
      ? Partial<{
          true: OptionMetadata;
          false: OptionMetadata;
        }>
      : ConfigSchemas.Config[K] extends readonly unknown[]
        ? Partial<Record<string, OptionMetadata>>
        : never;

  /**
   * Group that this config belongs to. Used for partial presets
   */
  group: ConfigSchemas.ConfigGroupName;

  /**
   * Is a test restart required after this config change?
   */
  changeRequiresRestart: boolean;
  /**
   * Optional function that checks if the config value is blocked from being set.
   * Returns true if setting the config value should be blocked.
   * @param options - The options object containing the value being set and the current config.
   */
  isBlocked?: (options: {
    value: ConfigSchemas.Config[K];
    currentConfig: Readonly<ConfigSchemas.Config>;
  }) => boolean;
  /**
   * Optional function to override the value before setting it.
   * Returns the modified value.
   * @param options - The options object containing the value being set, the current value, and the current config.
   * @returns The modified value to be set for the config key.
   */
  overrideValue?: (options: {
    value: ConfigSchemas.Config[K];
    currentValue: ConfigSchemas.Config[K];
    currentConfig: Readonly<ConfigSchemas.Config>;
  }) => ConfigSchemas.Config[K];
  /**
   * Optional function to override other config values before this one is set.
   * Returns an object with the config keys and their new values.
   * @param options - The options object containing the value being set and the current config.
   */
  overrideConfig?: (options: {
    value: ConfigSchemas.Config[K];
    currentConfig: Readonly<ConfigSchemas.Config>;
  }) => Partial<ConfigSchemas.Config>;
  /**
   * Optional function that is called after the config value is set.
   * It can be used to perform additional actions, like reloading the page.
   * @param options - The options object containing the nosave flag and the current config.
   */
  afterSet?: (options: {
    nosave: boolean;
    currentConfig: Readonly<ConfigSchemas.Config>;
  }) => void;
};

export type ConfigMetadataObject = {
  [K in keyof ConfigSchemas.Config]: ConfigMetadata<K>;
};

/** Web-only icons, layout hooks and rules that depend on browser state. */
type WebConfigMetadata<K extends keyof ConfigSchemas.Config> = Pick<
  ConfigMetadata<K>,
  | "fa"
  | "triggerResize"
  | "isBlocked"
  | "overrideValue"
  | "overrideConfig"
  | "afterSet"
> & {
  optionsMetadata?: Partial<Record<string, { fa: FaObject }>>;
};

const webConfigMetadata: {
  [K in keyof ConfigSchemas.Config]: WebConfigMetadata<K>;
} = {
  punctuation: { fa: { icon: "fa-at" } },
  numbers: { fa: { icon: "fa-hashtag" } },
  words: { fa: { icon: "fa-font" } },
  time: { fa: { icon: "fa-clock" } },
  mode: {
    fa: { icon: "fa-bars" },
    optionsMetadata: {
      time: { fa: { icon: "fa-clock" } },
      words: { fa: { icon: "fa-font" } },
      quote: { fa: { icon: "fa-quote-left" } },
      zen: { fa: { icon: "fa-mountain" } },
      custom: { fa: { icon: "fa-wrench" } },
    },
    afterSet: ({ currentConfig }) => {
      if (currentConfig.mode === "zen" && currentConfig.paceCaret !== "off") {
        showNoticeNotification(`Pace caret will not work with zen mode.`);
      }
    },
  },
  quoteLength: { fa: { icon: "fa-quote-right" } },
  language: { fa: { icon: "fa-language" } },
  burstHeatmap: { fa: { icon: "fa-fire" } },
  difficulty: { fa: { icon: "fa-star" } },
  quickRestart: {
    fa: { icon: "fa-redo-alt" },
    // the command palette can't share a key with quick restart
    overrideConfig: ({ value, currentConfig }) => {
      if (
        getCommandPaletteHotkeyError(
          currentConfig.commandPaletteHotkey,
          value,
        ) === undefined
      ) {
        return {};
      }
      showNoticeNotification(
        "Command palette shortcut was reset because quick restart uses the same key",
      );
      return { commandPaletteHotkey: DEFAULT_COMMAND_PALETTE_HOTKEY };
    },
  },
  repeatQuotes: { fa: { icon: "fa-sync-alt" } },
  resultSaving: { fa: { icon: "fa-save" } },
  blindMode: { fa: { icon: "fa-eye-slash" } },
  alwaysShowWordsHistory: { fa: { icon: "fa-align-left" } },
  singleListCommandLine: { fa: { icon: "fa-list" } },
  commandPaletteHotkey: {
    fa: { icon: "fa-terminal" },
    overrideValue: ({ value }) => normalizeCommandPaletteHotkey(value),
    isBlocked: ({ value, currentConfig }) => {
      const error = getCommandPaletteHotkeyError(
        value,
        currentConfig.quickRestart,
      );
      if (error === undefined) return false;
      showNoticeNotification(error);
      return true;
    },
  },
  minWpm: { fa: { icon: "fa-bomb" } },
  minWpmCustomSpeed: { fa: { icon: "fa-bomb" } },
  minAcc: { fa: { icon: "fa-bomb" } },
  minAccCustom: { fa: { icon: "fa-bomb" } },
  minBurst: { fa: { icon: "fa-bomb" } },
  minBurstCustomSpeed: { fa: { icon: "fa-bomb" } },
  britishEnglish: { fa: { icon: "fa-language" } },
  funbox: { fa: { icon: "fa-gamepad" } },
  customLayoutfluid: { fa: { icon: "fa-tint" } },
  customPolyglot: { fa: { icon: "fa-language" } },
  freedomMode: { fa: { icon: "fa-feather-alt" } },
  strictSpace: { fa: { icon: "fa-minus" } },
  oppositeShiftMode: { fa: { icon: "fa-exchange-alt" } },
  stopOnError: { fa: { icon: "fa-hand-paper" } },
  deleteOnError: { fa: { icon: "fa-eraser" } },
  confidenceMode: { fa: { icon: "fa-backspace" } },
  quickEnd: { fa: { icon: "fa-step-forward" } },
  indicateTypos: { fa: { icon: "fa-exclamation" } },
  compositionDisplay: { fa: { icon: "fa-language" } },
  hideExtraLetters: { fa: { icon: "fa-eye-slash" } },
  lazyMode: { fa: { icon: "fa-couch" } },
  layout: { fa: { icon: "fa-keyboard" } },
  codeUnindentOnBackspace: { fa: { icon: "fa-code" } },
  soundVolume: { fa: { icon: "fa-volume-down" } },
  playSoundOnClick: { fa: { icon: "fa-volume-up" } },
  playSoundOnError: { fa: { icon: "fa-volume-mute" } },
  playTimeWarning: { fa: { icon: "fa-exclamation-triangle" } },
  smoothCaret: { fa: { icon: "fa-i-cursor" } },
  caretStyle: { fa: { icon: "fa-i-cursor" } },
  paceCaret: {
    fa: { icon: "fa-i-cursor" },
    isBlocked: ({ value }) => {
      if (document.readyState === "complete") {
        if ((value === "pb" || value === "tagPb") && !isAuthenticated()) {
          showNoticeNotification(
            `Pace caret "pb" and "tag pb" are unavailable without an account`,
          );
          return true;
        }
      }
      return false;
    },
  },
  paceCaretCustomSpeed: { fa: { icon: "fa-i-cursor" } },
  paceCaretStyle: { fa: { icon: "fa-i-cursor" } },
  repeatedPace: { fa: { icon: "fa-i-cursor" } },
  timerStyle: { fa: { icon: "fa-chart-pie" } },
  liveSpeedStyle: { fa: { icon: "fa-i-cursor" } },
  liveAccStyle: { fa: { icon: "fa-i-cursor" } },
  liveBurstStyle: { fa: { icon: "fa-i-cursor" } },
  timerColor: { fa: { icon: "fa-chart-pie" } },
  timerOpacity: { fa: { icon: "fa-chart-pie" } },
  highlightMode: { fa: { icon: "fa-highlighter" } },
  typedEffect: { fa: { icon: "fa-eye" } },
  tapeMode: { fa: { icon: "fa-tape" }, triggerResize: true },
  tapeMargin: { fa: { icon: "fa-tape" }, triggerResize: true },
  smoothLineScroll: { fa: { icon: "fa-align-left" } },
  showAllLines: { fa: { icon: "fa-align-left" } },
  alwaysShowDecimalPlaces: { fa: { icon: "fa-ellipsis-h" } },
  typingSpeedUnit: { fa: { icon: "fa-i-cursor" } },
  startGraphsAtZero: { fa: { icon: "fa-chart-line" } },
  maxLineWidth: { fa: { icon: "fa-text-width" }, triggerResize: true },
  fontSize: { fa: { icon: "fa-font" }, triggerResize: true },
  fontFamily: { fa: { icon: "fa-font" } },
  keymapMode: { fa: { icon: "fa-keyboard" } },
  keymapLayout: { fa: { icon: "fa-keyboard" } },
  keymapStyle: { fa: { icon: "fa-keyboard" } },
  keymapLegendStyle: { fa: { icon: "fa-keyboard" } },
  keymapKeys: { fa: { icon: "fa-keyboard" } },
  keymapSize: { fa: { icon: "fa-keyboard" }, triggerResize: true },
  flipTestColors: { fa: { icon: "fa-adjust" } },
  colorfulMode: { fa: { icon: "fa-fill-drip" } },
  customBackground: { fa: { icon: "fa-link" } },
  customBackgroundSize: { fa: { icon: "fa-image" } },
  customBackgroundFilter: { fa: { icon: "fa-image" } },
  autoSwitchTheme: { fa: { icon: "fa-palette" } },
  themeLight: { fa: { icon: "fa-palette" } },
  themeDark: { fa: { icon: "fa-palette" } },
  randomTheme: {
    fa: { icon: "fa-palette" },
    isBlocked: ({ value }) => {
      if (value === "custom") {
        if (!isAuthenticated()) {
          showNoticeNotification(
            "Random theme 'custom' is unavailable without an account",
          );
          return true;
        }
        if (untrack(CustomThemes.getCustomThemes).length === 0) {
          showNoticeNotification(
            "Random theme 'custom' requires at least one custom theme to be saved",
          );
          return true;
        }
      }
      return false;
    },
  },
  favThemes: { fa: { icon: "fa-palette" } },
  theme: { fa: { icon: "fa-palette" } },
  customTheme: { fa: { icon: "fa-palette" } },
  customThemeColors: { fa: { icon: "fa-palette" } },
  showKeyTips: { fa: { icon: "fa-question" } },
  showOutOfFocusWarning: { fa: { icon: "fa-exclamation" } },
  showTestModesNotice: { fa: { icon: "fa-info-circle" } },
  capsLockWarning: { fa: { icon: "fa-exclamation-triangle" } },
  showAverage: { fa: { icon: "fa-chart-bar" } },
  showPb: { fa: { icon: "fa-crown" } },
  accountChart: { fa: { icon: "fa-chart-line" } },
  monkey: { fa: { icon: "fa-egg" } },
  monkeyPowerLevel: { fa: { icon: "fa-egg" } },
};

function withWebMetadata<K extends keyof ConfigSchemas.Config>(
  key: K,
): ConfigMetadata<K> {
  const { blockedReason, optionsMetadata, ...shared } =
    sharedConfigMetadata[key];
  const {
    isBlocked,
    optionsMetadata: webOptions,
    ...web
  } = webConfigMetadata[key];
  const options = optionsMetadata as
    | Record<string, ConfigOptionMetadata>
    | undefined;
  const paletteOptions = commandlineOptionLabels[key];
  const paletteTitle = commandlineTitles[key];
  return {
    ...shared,
    ...web,
    ...(paletteTitle === undefined
      ? {}
      : { commandline: { title: paletteTitle } }),
    ...(options === undefined &&
    webOptions === undefined &&
    paletteOptions === undefined
      ? {}
      : {
          optionsMetadata: Object.fromEntries(
            [
              ...new Set([
                ...Object.keys(options ?? {}),
                ...Object.keys(webOptions ?? {}),
                ...Object.keys(paletteOptions ?? {}),
              ]),
            ].map((option) => [
              option,
              {
                ...options?.[option],
                ...webOptions?.[option],
                ...paletteOptions?.[option],
              },
            ]),
          ) as ConfigMetadata<K>["optionsMetadata"],
        }),
    ...(blockedReason === undefined && isBlocked === undefined
      ? {}
      : {
          isBlocked: (options) => {
            const reason = blockedReason?.(options);
            if (reason !== undefined) {
              showNoticeNotification(reason);
              return true;
            }
            return isBlocked?.(options) ?? false;
          },
        }),
  };
}

export const configMetadata = Object.fromEntries(
  typedKeys(sharedConfigMetadata).map((key) => [key, withWebMetadata(key)]),
) as ConfigMetadataObject;
