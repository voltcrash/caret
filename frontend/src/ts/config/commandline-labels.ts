import { ConfigSchema, type ConfigKey } from "@caret/schemas/configs";
import { getOptions } from "@caret/util/zod";
import { typedKeys } from "@caret/util/objects";
import { Fonts } from "../constants/fonts";
import { LanguageList } from "../constants/languages";
import {
  getLanguageDisplayString,
  replaceUnderscoresWithSpaces,
} from "../utils/strings";

type PaletteOption = { commandlineLabel: string };

function labels<T extends string>(
  values: readonly T[],
  label: (value: T) => string,
): Record<string, PaletteOption> {
  return Object.fromEntries(
    values.map((value) => [value, { commandlineLabel: label(value) }] as const),
  );
}

function stringOptions(key: ConfigKey): string[] {
  return (getOptions(ConfigSchema.shape[key]) ?? []).filter(
    (option): option is string => typeof option === "string",
  );
}

const onOffLabels = {
  true: { commandlineLabel: "on" },
  false: { commandlineLabel: "off" },
};

// Palette wording can differ from settings labels; keep both in config metadata.
export const commandlineOptionLabels: Partial<
  Record<ConfigKey, Record<string, PaletteOption>>
> = {
  quoteLength: {
    "0,1,2,3": { commandlineLabel: "all" },
    "0": { commandlineLabel: "short" },
    "1": { commandlineLabel: "medium" },
    "2": { commandlineLabel: "long" },
    "3": { commandlineLabel: "thicc" },
    "-3": { commandlineLabel: "favorite" },
  },
  language: labels(LanguageList, getLanguageDisplayString),
  blindMode: { true: { commandlineLabel: "on" } },
  deleteOnError: labels(
    stringOptions("deleteOnError"),
    replaceUnderscoresWithSpaces,
  ),
  layout: labels(stringOptions("layout"), (value) =>
    value === "default" ? "off" : replaceUnderscoresWithSpaces(value),
  ),
  soundVolume: {
    "0.1": { commandlineLabel: "quiet" },
    "0.5": { commandlineLabel: "medium" },
    "1": { commandlineLabel: "loud" },
  },
  playSoundOnError: { "4": { commandlineLabel: "punch miss" } },
  paceCaret: { tagPb: { commandlineLabel: "tagPb" } },
  timerStyle: labels(stringOptions("timerStyle"), replaceUnderscoresWithSpaces),
  highlightMode: labels(
    stringOptions("highlightMode"),
    replaceUnderscoresWithSpaces,
  ),
  fontFamily: labels(
    typedKeys(Fonts),
    (name) => Fonts[name].display ?? replaceUnderscoresWithSpaces(name),
  ),
  keymapStyle: labels(
    stringOptions("keymapStyle"),
    replaceUnderscoresWithSpaces,
  ),
  keymapLayout: labels(stringOptions("keymapLayout"), (value) =>
    value === "overrideSync"
      ? "emulator sync"
      : replaceUnderscoresWithSpaces(value),
  ),
  keymapKeys: labels(stringOptions("keymapKeys"), replaceUnderscoresWithSpaces),
  randomTheme: { fav: { commandlineLabel: "fav" } },
  showKeyTips: onOffLabels,
  showOutOfFocusWarning: onOffLabels,
  showTestModesNotice: onOffLabels,
  capsLockWarning: onOffLabels,
  monkeyPowerLevel: {
    "1": { commandlineLabel: "mellow" },
    "2": { commandlineLabel: "high" },
    "3": { commandlineLabel: "ultra" },
    "4": { commandlineLabel: "over 9000" },
  },
};

export const commandlineTitles: Partial<Record<ConfigKey, string>> = {
  minWpm: "Minimum speed...",
  minAcc: "Minimum accuracy...",
  playSoundOnClick: "Sound on click...",
  playSoundOnError: "Sound on error...",
  paceCaret: "Pace caret mode...",
  timerColor: "Live progress color...",
  timerOpacity: "Live progress opacity...",
  showKeyTips: "Key tips...",
  showOutOfFocusWarning: "Out of focus warning...",
  showTestModesNotice: "Test modes notice...",
};
