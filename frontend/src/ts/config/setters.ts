import * as ConfigSchemas from "@oxytype/schemas/configs";
import { ZodType as ZodSchema } from "zod/v3";
import { saveToLocalStorage } from "../config/persistence";
import { configEvent, type ConfigEventData } from "../events/config";
import { showNoticeNotification } from "../states/notifications";
import {
  canSetConfigWithCurrentFunboxes,
  canSetFunboxWithConfig,
} from "./funbox-validation";
import { camelCaseToWords, capitalizeFirstLetter } from "../utils/strings";
import { configMetadata } from "./metadata";
import { Config, setConfigStore } from "./store";
import { isConfigValueValid } from "./validation";
import { FunboxName } from "@oxytype/schemas/configs";
import { typedKeys } from "@oxytype/util/objects";
import { isTestActive } from "../states/test";

export function setConfig<T extends keyof ConfigSchemas.Config>(
  key: T,
  value: ConfigSchemas.Config[T],
  options?: {
    nosave?: boolean;
    partOfFullConfigChange?: boolean;
  },
): boolean {
  const metadata = configMetadata[key];
  if (metadata === undefined) {
    throw new Error(`Config metadata for key "${key}" is not defined.`);
  }

  if (metadata.overrideValue) {
    value = metadata.overrideValue({
      value,
      currentValue: Config[key],
      currentConfig: Config,
    });
  }

  const previousValue = Config[key];

  if (
    metadata.changeRequiresRestart &&
    isTestActive() &&
    Config.funbox.includes("no_quit")
  ) {
    showNoticeNotification(
      "No quit funbox is active. Please finish the test.",
      {
        important: true,
      },
    );
    console.warn(
      `Could not set config key "${key}" with value "${JSON.stringify(
        value,
      )}" - no quit funbox active.`,
    );
    return false;
  }

  if (metadata.isBlocked?.({ value, currentConfig: Config })) {
    console.warn(
      `Could not set config key "${key}" with value "${JSON.stringify(
        value,
      )}" - blocked.`,
    );
    return false;
  }

  const schema = ConfigSchemas.ConfigSchema.shape[key] as ZodSchema;

  if (!isConfigValueValid(metadata.displayString ?? key, value, schema)) {
    console.warn(
      `Could not set config key "${key}" with value "${JSON.stringify(
        value,
      )}" - invalid value.`,
    );
    return false;
  }

  if (!canSetConfigWithCurrentFunboxes(key, value, Config.funbox)) {
    if (key === "words" || key === "time") {
      showNoticeNotification("Active funboxes do not support infinite tests");
    } else {
      showNoticeNotification(
        `You can't set ${camelCaseToWords(
          key,
        )} to ${String(value)} with currently active funboxes.`,
        { durationMs: 5000 },
      );
    }
    console.warn(
      `Could not set config key "${key}" with value "${JSON.stringify(
        value,
      )}" - funbox conflict.`,
    );
    return false;
  }

  if (metadata.overrideConfig) {
    const targetConfig = metadata.overrideConfig({
      value,
      currentConfig: Config,
    });

    for (const targetKey of typedKeys(targetConfig)) {
      const targetValue = targetConfig[
        targetKey
      ] as ConfigSchemas.Config[keyof typeof configMetadata];

      if (Config[targetKey] === targetValue) {
        continue; // no need to set if the value is already the same
      }

      const set = setConfig(targetKey, targetValue, options);
      if (!set) {
        throw new Error(
          `Failed to set config key "${targetKey}" with value "${targetValue}" for ${metadata.displayString} config override.`,
        );
      }
    }
  }

  Config[key] = value;
  if (!options?.nosave) saveToLocalStorage(key, options?.nosave);

  // The generic key and both values share Config[T]; preserve that pair in the event union.
  configEvent.dispatch({
    key: key,
    newValue: value,
    nosave: options?.nosave ?? false,
    previousValue: previousValue,
  } as ConfigEventData);

  if (!options?.partOfFullConfigChange) {
    setConfigStore(key, value);
  }

  if (metadata.triggerResize && !options?.nosave) {
    window.dispatchEvent(new Event("resize"));
  }

  metadata.afterSet?.({
    nosave: options?.nosave ?? false,
    currentConfig: Config,
  });
  return true;
}

export function setQuoteLengthAll(nosave?: boolean): boolean {
  return setConfig("quoteLength", [0, 1, 2, 3], {
    nosave,
  });
}

export function toggleFunbox(funbox: FunboxName, nosave?: boolean): boolean {
  if (isTestActive() && Config.funbox.includes("no_quit")) {
    showNoticeNotification(
      "No quit funbox is active. Please finish the test.",
      {
        important: true,
      },
    );
    return false;
  }

  const funboxCheck = canSetFunboxWithConfig(funbox, Config);
  if (!funboxCheck.ok) {
    const errorStrings = funboxCheck.errors.map(
      (e) =>
        `${capitalizeFirstLetter(
          camelCaseToWords(e.key),
        )} cannot be set to ${String(e.value)}.`,
    );
    showNoticeNotification(
      [`You can't enable ${funbox.replace(/_/g, " ")}:`, ...errorStrings],
      { durationMs: 5000 },
    );
    return false;
  }

  const previousValue = Config.funbox;

  let newConfig: FunboxName[] = Config.funbox;

  if (newConfig.includes(funbox)) {
    newConfig = newConfig.filter((it) => it !== funbox);
  } else {
    newConfig = [...newConfig, funbox].sort();
  }

  if (!isConfigValueValid("funbox", newConfig, ConfigSchemas.FunboxSchema)) {
    return false;
  }

  Config.funbox = newConfig;
  saveToLocalStorage("funbox", nosave);
  configEvent.dispatch({
    key: "funbox",
    newValue: Config.funbox,
    nosave,
    previousValue,
  });

  setConfigStore("funbox", newConfig);

  return true;
}
