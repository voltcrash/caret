import type { Config as ConfigSchema } from "@caret/schemas/configs";
import {
  migrateConfig,
  supportedConfigSchema,
} from "@caret/web-shared/config/migrate";
import { setProperty, typedKeys } from "@caret/util/objects";
import { getDefaultConfig } from "../constants/default-config";
import { getMutableConfig } from "./store";

export { migrateConfig };

export function exportConfigToJson(): string {
  return JSON.stringify(
    supportedConfigSchema.parse(migrateConfig(getMutableConfig())),
    null,
    2,
  );
}

export function getConfigChanges(): Partial<ConfigSchema> {
  const configChanges: Partial<ConfigSchema> = {};
  typedKeys(getMutableConfig())
    .filter((key) => {
      return getMutableConfig()[key] !== getDefaultConfig()[key];
    })
    .forEach((key) => {
      setProperty(configChanges, key, getMutableConfig()[key]);
    });
  return configChanges;
}
