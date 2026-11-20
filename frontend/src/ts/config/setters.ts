import { batch } from "solid-js";
import * as ConfigSchemas from "@caret/schemas/configs";
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
import { peekConfig, setConfigStore } from "./store";
import { isConfigValueValid } from "./validation";
import { FunboxName } from "@caret/schemas/configs";
import { typedKeys } from "@caret/util/objects";
import { isTestActive } from "../states/test";
import { isNoQuitActive } from "../typing-host";

export function setConfig<T extends keyof ConfigSchemas.Config>(
  key: T,
  value: ConfigSchemas.Config[T],
  options?: {
    nosave?: boolean;
  },
): boolean {
  const metadata = configMetadata[key];
  if (metadata === undefined) {
    throw new Error(`Config metadata for key "${key}" is not defined.`);
  }

  if (metadata.overrideValue) {
    value = metadata.overrideValue({
      value,
      currentValue: peekConfig()[key],
      currentConfig: peekConfig(),
    });
  }

  const previousValue = peekConfig()[key];

  if (metadata.changeRequiresRestart && isTestActive() && isNoQuitActive()) {
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

  if (metadata.isBlocked?.({ value, currentConfig: peekConfig() })) {
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

  if (!canSetConfigWithCurrentFunboxes(key, value, peekConfig().funbox)) {
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
      currentConfig: peekConfig(),
    });

    for (const targetKey of typedKeys(targetConfig)) {
      const targetValue = targetConfig[
        targetKey
      ] as ConfigSchemas.Config[keyof typeof configMetadata];

      if (peekConfig()[targetKey] === targetValue) {
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

  commitConfig(key, value, previousValue, options);

  if (metadata.triggerResize && !options?.nosave) {
    window.dispatchEvent(new Event("resize"));
  }

  metadata.afterSet?.({
    nosave: options?.nosave ?? false,
    currentConfig: peekConfig(),
  });
  return true;
}

export function setQuoteLengthAll(nosave?: boolean): boolean {
  return setConfig("quoteLength", [0, 1, 2, 3], {
    nosave,
  });
}

export function toggleFunbox(funbox: FunboxName, nosave?: boolean): boolean {
  if (isTestActive() && isNoQuitActive()) {
    showNoticeNotification(
      "No quit funbox is active. Please finish the test.",
      {
        important: true,
      },
    );
    return false;
  }

  const funboxCheck = canSetFunboxWithConfig(funbox, peekConfig());
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

  const previousValue = peekConfig().funbox;

  let newConfig: FunboxName[] = peekConfig().funbox;

  if (newConfig.includes(funbox)) {
    newConfig = newConfig.filter((it) => it !== funbox);
  } else {
    newConfig = [...newConfig, funbox].sort();
  }

  if (!isConfigValueValid("funbox", newConfig, ConfigSchemas.FunboxSchema)) {
    return false;
  }

  commitConfig("funbox", newConfig, previousValue, { nosave });

  return true;
}

/** The one write path: store the value, persist it and announce the change. */
function commitConfig<T extends keyof ConfigSchemas.Config>(
  key: T,
  value: ConfigSchemas.Config[T],
  previousValue: ConfigSchemas.Config[T],
  options?: { nosave?: boolean },
): void {
  // Listeners read the new value everywhere; reactive readers update after them.
  batch(() => {
    setConfigStore(key, value);
    if (!options?.nosave) saveToLocalStorage(key, options?.nosave);

    // The generic key and both values share Config[T]; preserve that pair in the event union.
    configEvent.dispatch({
      key: key,
      newValue: value,
      nosave: options?.nosave ?? false,
      previousValue: previousValue,
    } as ConfigEventData);
  });
}
