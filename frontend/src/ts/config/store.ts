import type { Config as ConfigSchema } from "@oxytype/schemas/configs";
import { getDefaultConfig } from "../constants/default-config";
import { reconcile } from "solid-js/store";
import { createAppOwned } from "../../app/application";
import { createAppStore } from "../../app/state";

export const getMutableConfig = createAppOwned(getDefaultConfig);

const [getConfigStore, setConfigStoreRaw] =
  createAppStore<ConfigSchema>(getDefaultConfig);

export const getConfig = getConfigStore;

export function setFullConfigStore(newConfig: ConfigSchema): void {
  setConfigStoreRaw(reconcile(newConfig));
}

export function setConfigStore<K extends keyof ConfigSchema>(
  key: K,
  value: ConfigSchema[K],
): void {
  if (Array.isArray(value)) {
    setConfigStoreRaw(key, reconcile(value));
  } else {
    setConfigStoreRaw(key, value);
  }
}

// window.getConfigStore = getConfigStore;
