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

let configToSend: Partial<ConfigSchemas.Config> = {};

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
    setProperty(configToSend, key, getMutableConfig()[key]);
    saveToDatabase();
  }
}

export function saveFullConfigToLocalStorage(noDbCheck = false): void {
  console.log("saving full config to localStorage");
  configLS.set(getMutableConfig());
  if (!noDbCheck) {
    setAccountButtonSpinner(true);
    void saveConfig(getMutableConfig()).finally(() => {
      setAccountButtonSpinner(false);
    });
  }
}

const saveToDatabase = debounce(1000, () => {
  if (Object.keys(configToSend).length > 0) {
    setAccountButtonSpinner(true);
    void saveConfig(configToSend).finally(() => {
      setAccountButtonSpinner(false);
    });
  }
  configToSend = {};
});

export function resetPendingConfigSync(
  newConfigToSend: Partial<ConfigSchemas.Config>,
): void {
  configToSend = newConfigToSend;
}
