import { preferencesReadiness } from "../../app/readiness";
import * as ConfigSchemas from "@oxytype/schemas/configs";
import { parseWithSchema as parseJsonWithSchema } from "@oxytype/util/json";
import {
  showSuccessNotification,
  showErrorNotification,
} from "../states/notifications";
import {
  configLS,
  saveToLocalStorage,
  saveFullConfigToLocalStorage,
} from "./persistence";
import { getMutableConfig, setFullConfigStore } from "./store";
import { getDefaultConfig } from "../constants/default-config";
import { configEvent } from "../events/config";
import { migrateConfig } from "./utils";
import { isObject } from "../utils/misc";
import { setConfig } from "./setters";
import { deleteConfig } from "../ape/config";
import { setProperty, typedKeys } from "@oxytype/util/objects";
import { lastConfigsToApply } from "@oxytype/typing-core/config/setter";

export async function applyConfigFromJson(json: string): Promise<boolean> {
  try {
    const parsedConfig = parseJsonWithSchema(
      json,
      ConfigSchemas.PartialConfigSchema,
      {
        migrate: (value) => {
          if (!isObject(value)) {
            throw new Error("Settings JSON must be an object");
          }
          return migrateConfig(value);
        },
      },
    );
    await applyConfig(parsedConfig);
    saveFullConfigToLocalStorage();
    showSuccessNotification("Done");
    return true;
  } catch (e) {
    console.error(e);
    showErrorNotification("Failed to import settings", { error: e });
    return false;
  }
}

export async function loadFromLocalStorage(): Promise<void> {
  return preferencesReadiness().start(async () => {
    console.log("loading localStorage config");
    const newConfig = configLS.get();
    if (newConfig === undefined) {
      await resetConfig();
    } else {
      await applyConfig(newConfig);
      saveFullConfigToLocalStorage(true);
    }
  });
}

export async function applyConfig(
  partialConfig: Partial<ConfigSchemas.Config>,
): Promise<void> {
  if (partialConfig === undefined || partialConfig === null) return;

  //migrate old values if needed, remove additional keys and merge with default config
  const fullConfig: ConfigSchemas.Config = migrateConfig(partialConfig);

  configEvent.dispatch({ key: "fullConfigChange" });

  const defaultConfig = getDefaultConfig();
  for (const key of typedKeys(fullConfig)) {
    setProperty(getMutableConfig(), key, defaultConfig[key]);
  }

  const configKeysToReset: (keyof ConfigSchemas.Config)[] = [];

  const firstKeys = typedKeys(fullConfig).filter(
    (key) => !lastConfigsToApply.has(key),
  );

  for (const configKey of [...firstKeys, ...lastConfigsToApply]) {
    const configValue = fullConfig[configKey];

    const set = setConfig(configKey, configValue, {
      nosave: true,
      partOfFullConfigChange: true,
    });

    if (!set) {
      configKeysToReset.push(configKey);
    }
  }

  for (const key of configKeysToReset) {
    saveToLocalStorage(key);
  }

  configEvent.dispatch({ key: "fullConfigChangeFinished" });
  setFullConfigStore(fullConfig);
}

export async function resetConfig(): Promise<void> {
  await applyConfig(getDefaultConfig());
  await deleteConfig();
  saveFullConfigToLocalStorage(true);
}
