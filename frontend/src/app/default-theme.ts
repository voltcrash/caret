import { ThemeName } from "@oxytype/schemas/configs";
import { defaultThemes } from "@oxytype/web-shared/config/default-config";
import { tryCatchSync } from "@oxytype/util/trycatch";

// Also read and written by the document theme bootstrap script.
export const DEFAULT_THEME_KEY = "defaultTheme";

function isDefaultTheme(value: unknown): value is ThemeName {
  return (defaultThemes as readonly unknown[]).includes(value);
}

/**
 * The default theme for this browser: picked once at random from the
 * flagship themes, then persisted so resets and default checks stay stable.
 */
export function getBrowserDefaultTheme(): ThemeName {
  if (typeof window === "undefined") return defaultThemes[0];

  const { data: stored, error: readError } = tryCatchSync(() =>
    window.localStorage.getItem(DEFAULT_THEME_KEY),
  );
  if (readError) return defaultThemes[0];
  if (isDefaultTheme(stored)) return stored;

  const picked =
    defaultThemes[Math.floor(Math.random() * defaultThemes.length)] ??
    defaultThemes[0];
  const { error: writeError } = tryCatchSync(() =>
    window.localStorage.setItem(DEFAULT_THEME_KEY, picked),
  );
  // Without storage the pick would change on every call.
  return writeError ? defaultThemes[0] : picked;
}
