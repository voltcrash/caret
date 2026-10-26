import { projectEngineConfig } from "@oxytype/typing-engine/config";
import { ConfigSchema, type Config } from "@oxytype/schemas/configs";
import { getDefaultConfig as getBaseDefaultConfig } from "@oxytype/web-shared/config/default-config";

export function getDefaultConfig(): Config {
  return ConfigSchema.parse({
    ...getBaseDefaultConfig(),
    ...projectEngineConfig({}),
  });
}
