import { createAppOwned } from "../../app/application";
import { getBrowserEngine } from "../../features/typing/engine.client";
import { batch } from "solid-js";
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
import { deleteConfig } from "./sync";
import { setProperty, typedKeys } from "@oxytype/util/objects";
import { lastConfigsToApply } from "@oxytype/web-shared/config/apply-order";

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

const localConfigRetry = createAppOwned(() => ({
  pending: undefined as Partial<ConfigSchemas.Config> | undefined,
}));

/** A failed engine download must not erase constrained saved preferences. */
export async function applyPendingLocalConfig(): Promise<void> {
  const state = localConfigRetry();
  const pending = state.pending;
  if (pending === undefined) {
    return;
  }
  await applyConfig(pending);
  if (state.pending !== pending) {
    return;
  }
  state.pending = undefined;
  saveFullConfigToLocalStorage(true);
}

export async function loadFromLocalStorage(): Promise<void> {
  return preferencesReadiness().start(async () => {
    console.log("loading localStorage config");
    const newConfig = configLS.get();
    if (newConfig === undefined) {
      await resetConfig();
    } else {
      try {
        await applyConfig(newConfig);
      } catch (error) {
        if (getBrowserEngine().status().state !== "failed") {
          throw error;
        }
        localConfigRetry().pending = newConfig;
        return;
      }
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

  if (fullConfig.funbox.length !== 0) {
    await getBrowserEngine().load();
  }

  // Publish one settled configuration to reactive UI subscribers.
  batch(() => {
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
  });
}

export async function resetConfig(): Promise<void> {
  await applyConfig(getDefaultConfig());
  await deleteConfig();
  saveFullConfigToLocalStorage(true);
}
