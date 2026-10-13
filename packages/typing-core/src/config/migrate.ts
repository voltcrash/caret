import type {
  Config as ConfigSchema,
  FunboxName,
  PartialConfig,
} from "@oxytype/schemas/configs";
import * as ConfigSchemas from "@oxytype/schemas/configs";
import { typedKeys } from "@oxytype/util/objects";
import { sanitize } from "@oxytype/util/sanitize";
import { getDefaultConfig } from "./default-config";

// The shared schema retains removed features for saved-config compatibility.
const supportedCaretStyleSchema = ConfigSchemas.CaretStyleSchema.refine(
  (style) => !["banana", "carrot", "monkey"].includes(style),
);
export const supportedConfigSchema = ConfigSchemas.ConfigSchema.omit({
  monkey: true,
})
  .extend({
    caretStyle: supportedCaretStyleSchema,
    paceCaretStyle: supportedCaretStyleSchema,
  })
  .strip();

/**
 * migrates possible outdated config and merges with the default config values
 * @param config partial or possible outdated config
 * @returns
 */
export function migrateConfig(config: PartialConfig | object): ConfigSchema {
  return mergeWithDefaultConfig(sanitizeConfig(replaceLegacyValues(config)));
}

function mergeWithDefaultConfig(config: Partial<ConfigSchema>): ConfigSchema {
  const defaultConfig = getDefaultConfig();
  const mergedConfig = {} as ConfigSchema;
  function mergeValue<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] {
    const newValue = config[key] ?? defaultConfig[key];
    mergedConfig[key] = newValue;
    return newValue;
  }
  for (const key of typedKeys(defaultConfig)) mergeValue(key);
  return mergedConfig;
}

/**
 * remove all values from the config which are not valid
 */
function sanitizeConfig(
  config: ConfigSchemas.PartialConfig,
): ConfigSchemas.PartialConfig {
  return sanitize(supportedConfigSchema.partial(), config);
}

function replaceLegacyValues(
  configObj: ConfigSchemas.PartialConfig,
): ConfigSchemas.PartialConfig {
  //@ts-expect-error legacy configs
  if (configObj.quickTab === true && configObj.quickRestart === undefined) {
    configObj.quickRestart = "tab";
  }

  if (typeof configObj.smoothCaret === "boolean") {
    configObj.smoothCaret = configObj.smoothCaret ? "medium" : "off";
  }

  if (
    //@ts-expect-error legacy configs
    configObj.swapEscAndTab === true &&
    configObj.quickRestart === undefined
  ) {
    configObj.quickRestart = "esc";
  }

  if (
    //@ts-expect-error legacy configs
    configObj.alwaysShowCPM === true &&
    configObj.typingSpeedUnit === undefined
  ) {
    configObj.typingSpeedUnit = "cpm";
  }

  //@ts-expect-error legacy configs
  if (configObj.showAverage === "wpm") {
    configObj.showAverage = "speed";
  }

  if (typeof configObj.playSoundOnError === "boolean") {
    configObj.playSoundOnError = configObj.playSoundOnError ? "1" : "off";
  }

  if (
    //@ts-expect-error legacy configs
    configObj.showTimerProgress === false &&
    configObj.timerStyle === undefined
  ) {
    configObj.timerStyle = "off";
  }

  if (
    //@ts-expect-error legacy configs
    configObj.showLiveWpm === true &&
    configObj.liveSpeedStyle === undefined
  ) {
    let val: ConfigSchemas.LiveSpeedAccBurstStyle = "mini";
    if (configObj.timerStyle !== "bar" && configObj.timerStyle !== "off") {
      val = configObj.timerStyle as ConfigSchemas.LiveSpeedAccBurstStyle;
    }
    configObj.liveSpeedStyle = val;
  }

  if (
    //@ts-expect-error legacy configs
    configObj.showLiveBurst === true &&
    configObj.liveBurstStyle === undefined
  ) {
    let val: ConfigSchemas.LiveSpeedAccBurstStyle = "mini";
    if (configObj.timerStyle !== "bar" && configObj.timerStyle !== "off") {
      val = configObj.timerStyle as ConfigSchemas.LiveSpeedAccBurstStyle;
    }
    configObj.liveBurstStyle = val;
  }

  if (
    //@ts-expect-error legacy configs
    configObj.showLiveAcc === true &&
    configObj.liveAccStyle === undefined
  ) {
    let val: ConfigSchemas.LiveSpeedAccBurstStyle = "mini";
    if (configObj.timerStyle !== "bar" && configObj.timerStyle !== "off") {
      val = configObj.timerStyle as ConfigSchemas.LiveSpeedAccBurstStyle;
    }
    configObj.liveAccStyle = val;
  }

  if (typeof configObj.soundVolume === "string") {
    configObj.soundVolume = parseFloat(configObj.soundVolume);
  }

  if (typeof configObj.funbox === "string") {
    if (configObj.funbox === "none") {
      configObj.funbox = [];
    } else {
      configObj.funbox = (configObj.funbox as string).split(
        "#",
      ) as FunboxName[];
    }
  }

  if (typeof configObj.customLayoutfluid === "string") {
    configObj.customLayoutfluid = (configObj.customLayoutfluid as string).split(
      "#",
    ) as ConfigSchemas.CustomLayoutFluid;
  }

  if (typeof configObj.indicateTypos === "boolean") {
    configObj.indicateTypos =
      configObj.indicateTypos === false ? "off" : "replace";
  }

  if (typeof configObj.fontSize === "string") {
    //legacy values use strings
    const oldValue = configObj.fontSize;
    let newValue = parseInt(oldValue);

    if (oldValue === "125") {
      newValue = 1.25;
    } else if (oldValue === "15") {
      newValue = 1.5;
    }

    configObj.fontSize = newValue;
  } else if (configObj.fontSize !== undefined && configObj.fontSize < 0) {
    configObj.fontSize = 1;
  }

  if (
    Array.isArray(configObj.accountChart) &&
    configObj.accountChart.length !== 4
  ) {
    configObj.accountChart = ["on", "on", "on", "on"];
  }

  if (
    typeof configObj.minAccCustom === "number" &&
    configObj.minAccCustom > 100
  ) {
    configObj.minAccCustom = 100;
  }

  if (
    Array.isArray(configObj.customThemeColors) &&
    //@ts-expect-error legacy configs
    configObj.customThemeColors.length === 9
  ) {
    // migrate existing configs missing sub alt color
    const colors = configObj.customThemeColors;
    colors.splice(4, 0, "#000000");
    configObj.customThemeColors = colors;
  }

  if (
    Array.isArray(configObj.customBackgroundFilter) &&
    //@ts-expect-error legacy configs
    configObj.customBackgroundFilter.length === 5
  ) {
    const arr = configObj.customBackgroundFilter;
    configObj.customBackgroundFilter = [arr[0], arr[1], arr[2], arr[3]];
  }

  if (typeof configObj.quoteLength === "number") {
    if (configObj.quoteLength === -1) {
      configObj.quoteLength = [0, 1, 2, 3];
    } else {
      configObj.quoteLength = [configObj.quoteLength];
    }
  }

  if (configObj.tapeMargin !== undefined) {
    if (configObj.tapeMargin < 10) {
      configObj.tapeMargin = 10;
    } else if (configObj.tapeMargin > 90) {
      configObj.tapeMargin = 90;
    }
  }

  if (configObj.maxLineWidth !== undefined) {
    if (configObj.maxLineWidth < 20 && configObj.maxLineWidth !== 0) {
      configObj.maxLineWidth = 20;
    } else if (configObj.maxLineWidth > 1000) {
      configObj.maxLineWidth = 1000;
    }
  }

  if ("keymapShowTopRow" in configObj && configObj.keymapKeys === undefined) {
    switch (configObj.keymapShowTopRow) {
      case "never":
        configObj.keymapKeys = "minimal";
        break;
      case "always":
        configObj.keymapKeys = "minimal_numrow";
        break;
      case "layout":
        configObj.keymapKeys = "minimal";
        break;
    }
    delete configObj.keymapShowTopRow;
  }

  return configObj;
}
