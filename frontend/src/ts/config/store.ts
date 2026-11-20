import type { Config as ConfigSchema } from "@caret/schemas/configs";
import { getDefaultConfig } from "../constants/default-config";
import { createStore, reconcile, unwrap } from "solid-js/store";
import { createAppOwned } from "../../app/application";
import { appObject } from "../../app/state";

// One configuration per app: `getConfig` reads it reactively, and
// `peekConfig` returns the same object untracked for hot paths.
const configStore = createAppOwned(() =>
  createStore<ConfigSchema>(getDefaultConfig()),
);

export const getConfig = appObject(() => configStore()[0]);

/** The store's own object, read untracked. Write through the setters. */
export const peekConfig = createAppOwned((): Readonly<ConfigSchema> =>
  unwrap(configStore()[0]),
);

export function setFullConfigStore(newConfig: ConfigSchema): void {
  configStore()[1](reconcile(newConfig));
}

/**
 * Replaces one value. Arrays are copied, so neither earlier values nor the
 * caller's array alias the stored one.
 */
export function setConfigStore<K extends keyof ConfigSchema>(
  key: K,
  value: ConfigSchema[K],
): void {
  const stored = (Array.isArray(value) ? [...value] : value) as ConfigSchema[K];
  // Values are primitives or arrays, so the store sets them without merging.
  (configStore()[1] as (key: K, value: ConfigSchema[K]) => void)(key, stored);
}
