import type { Config as ConfigSchema } from "@oxytype/schemas/configs";
import { configMetadata } from "./metadata";
import { getDefaultConfig } from "../constants/default-config";
import { resetPendingConfigSync } from "./persistence";
import { getMutableConfig } from "./store";

export const __testing = {
  configMetadata,
  replaceConfig: (setConfig: Partial<ConfigSchema>): void => {
    const newConfig = { ...getDefaultConfig(), ...setConfig };
    for (const key of Object.keys(getMutableConfig())) {
      Reflect.deleteProperty(getMutableConfig(), key);
    }
    Object.assign(getMutableConfig(), newConfig);
    resetPendingConfigSync({});
  },
  getConfig: () => getMutableConfig(),
};
