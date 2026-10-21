import type { Theme } from "../constants/themes";

/** Theme colors keyed by CSS custom property name, without the leading `--`. */
export function toThemeVars(colors: Theme): Record<string, string> {
  return {
    "bg-color": colors.bg,
    "main-color": colors.main,
    "caret-color": colors.caret,
    "sub-color": colors.sub,
    "sub-alt-color": colors.subAlt,
    "text-color": colors.text,
    "error-color": colors.error,
    "error-extra-color": colors.errorExtra,
    "colorful-error-color": colors.colorfulError,
    "colorful-error-extra-color": colors.colorfulErrorExtra,
  };
}
