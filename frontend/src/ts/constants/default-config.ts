import { projectEngineConfig } from "@oxytype/typing-engine/config";
import { ConfigSchema, type Config } from "@oxytype/schemas/configs";
import { getDefaultConfig as getBaseDefaultConfig } from "@oxytype/web-shared/config/default-config";
import { convertThemeToCustomColors, themes } from "@oxytype/web-shared/themes";
import { getBrowserDefaultTheme } from "../../app/default-theme";

export function getDefaultConfig(): Config {
  const theme = getBrowserDefaultTheme();
  return ConfigSchema.parse({
    ...getBaseDefaultConfig(),
    ...projectEngineConfig({}),
    theme,
    themeDark: theme,
    customThemeColors: convertThemeToCustomColors(themes[theme]),
  });
}
