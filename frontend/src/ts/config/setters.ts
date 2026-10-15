import * as ConfigSchemas from "@oxytype/schemas/configs";
import { ZodType as ZodSchema } from "zod";
import { saveToLocalStorage } from "../config/persistence";
import { configEvent, type ConfigEventData } from "../events/config";
import { showNoticeNotification } from "../states/notifications";
import {
  canSetConfigWithCurrentFunboxes,
  canSetFunboxWithConfig,
} from "./funbox-validation";
import { camelCaseToWords, capitalizeFirstLetter } from "../utils/strings";
import { configMetadata } from "./metadata";
import { getMutableConfig, setConfigStore } from "./store";
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
      currentValue: getMutableConfig()[key],
      currentConfig: getMutableConfig(),
    });
  }

  const previousValue = getMutableConfig()[key];

  if (
    metadata.changeRequiresRestart &&
    isTestActive() &&
    getMutableConfig().funbox.includes("no_quit")
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

  if (metadata.isBlocked?.({ value, currentConfig: getMutableConfig() })) {
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

  if (!canSetConfigWithCurrentFunboxes(key, value, getMutableConfig().funbox)) {
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
      currentConfig: getMutableConfig(),
    });

    for (const targetKey of typedKeys(targetConfig)) {
      const targetValue = targetConfig[
        targetKey
      ] as ConfigSchemas.Config[keyof typeof configMetadata];

      if (getMutableConfig()[targetKey] === targetValue) {
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

  getMutableConfig()[key] = value;
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
    currentConfig: getMutableConfig(),
  });
  return true;
}

export function setQuoteLengthAll(nosave?: boolean): boolean {
  return setConfig("quoteLength", [0, 1, 2, 3], {
    nosave,
  });
}

export function toggleFunbox(funbox: FunboxName, nosave?: boolean): boolean {
  if (isTestActive() && getMutableConfig().funbox.includes("no_quit")) {
    showNoticeNotification(
      "No quit funbox is active. Please finish the test.",
      {
        important: true,
      },
    );
    return false;
  }

  const funboxCheck = canSetFunboxWithConfig(funbox, getMutableConfig());
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

  const previousValue = getMutableConfig().funbox;

  let newConfig: FunboxName[] = getMutableConfig().funbox;

  if (newConfig.includes(funbox)) {
    newConfig = newConfig.filter((it) => it !== funbox);
  } else {
    newConfig = [...newConfig, funbox].sort();
  }

  if (!isConfigValueValid("funbox", newConfig, ConfigSchemas.FunboxSchema)) {
    return false;
  }

  getMutableConfig().funbox = newConfig;
  saveToLocalStorage("funbox", nosave);
  configEvent.dispatch({
    key: "funbox",
    newValue: getMutableConfig().funbox,
    nosave,
    previousValue,
  });

  setConfigStore("funbox", newConfig);

  return true;
}
