import { Config } from "@oxytype/schemas/configs";
import { getDefaultConfig as getBaseDefaultConfig } from "@oxytype/typing-core/config/default-config";
import { getBrowserDefaultTheme } from "../../app/default-theme";

export function getDefaultConfig(): Config {
  const theme = getBrowserDefaultTheme();
  return { ...getBaseDefaultConfig(), theme, themeDark: theme };
}
