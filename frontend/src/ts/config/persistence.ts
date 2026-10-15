import { onCleanup } from "solid-js";
import { createAccountOwned, captureAccount } from "../../app/account-scope";
import { Config as ConfigSchema } from "@oxytype/schemas/configs";
import { saveConfig } from "../ape/config";
import { setAccountButtonSpinner } from "../states/header";
import { getMutableConfig } from "./store";
import * as ConfigSchemas from "@oxytype/schemas/configs";
import { getDefaultConfig } from "../constants/default-config";
import { migrateConfig } from "./utils";
import { LocalStorageWithSchema } from "../utils/local-storage-with-schema";
import { isObject } from "../utils/misc";
import { debounce } from "throttle-debounce";
import { setProperty } from "@oxytype/util/objects";

const pendingSync = createAccountOwned(() => {
  const current = {
    config: {} as Partial<ConfigSchemas.Config>,
    save: debounce(1000, () => {
      const pending = current.config;
      current.config = {};
      if (Object.keys(pending).length > 0) persist(pending);
    }),
  };
  onCleanup(() => current.save.cancel());
  return current;
});

function persist(config: Partial<ConfigSchemas.Config>): void {
  const lease = captureAccount();
  setAccountButtonSpinner(true);
  void saveConfig(config)
    .catch((error: unknown) => {
      if (lease.isCurrent()) console.error("Failed to save config", error);
    })
    .finally(() => {
      if (lease.isCurrent()) setAccountButtonSpinner(false);
    });
}

export const configLS = new LocalStorageWithSchema({
  key: "config",
  schema: ConfigSchemas.ConfigSchema,
  fallback: getDefaultConfig(),
  migrate: (value, _issues) => {
    if (!isObject(value)) {
      return getDefaultConfig();
    }
    //todo maybe send a full config to db so that it removes legacy values
    return migrateConfig(value);
  },
});

export function saveToLocalStorage(
  key: keyof ConfigSchema,
  nosave = false,
  noDbCheck = false,
): void {
  if (nosave) return;
  configLS.set(getMutableConfig());
  if (!noDbCheck) {
    setProperty(pendingSync().config, key, getMutableConfig()[key]);
    pendingSync().save();
  }
}

export function saveFullConfigToLocalStorage(noDbCheck = false): void {
  console.log("saving full config to localStorage");
  configLS.set(getMutableConfig());
  if (!noDbCheck) {
    persist(structuredClone(getMutableConfig()));
  }
}

export function resetPendingConfigSync(
  newConfigToSend: Partial<ConfigSchemas.Config>,
): void {
  pendingSync().save.cancel({ upcomingOnly: true });
  pendingSync().config = newConfigToSend;
}
