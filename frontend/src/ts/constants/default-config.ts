import { projectEngineConfig } from "@caret/typing-engine/config";
import { ConfigSchema, type Config } from "@caret/schemas/configs";
import { getDefaultConfig as getBaseDefaultConfig } from "@caret/web-shared/config/default-config";

export function getDefaultConfig(): Config {
  return ConfigSchema.parse({
    ...getBaseDefaultConfig(),
    ...projectEngineConfig({}),
  });
}
