import {
  isAppLoading,
  getMediaQueryDebugLevel,
  isFocusCursorHidden,
} from "../../states/app";
import {
  getCrt,
  getFunboxBodyClasses,
  isFunboxReducedMotionIgnored,
} from "../../states/funbox";
import { getTheme } from "../../states/theme";
import { cn } from "../../utils/cn";
import { isColorDark } from "../../utils/colors";

const owned = new Set([
  "loading",
  "darkMode",
  "crtmode",
  "ignore-reduced-motion",
  "mediaQueryDebugLevel1",
  "mediaQueryDebugLevel2",
  "mediaQueryDebugLevel3",
  "cursor-none",
  "[&_button]:cursor-none!",
  "[&_a]:cursor-none!",
]);

/** Body classes the app owns; classes written by other code are kept. */
export function bodyClass(current: string): string {
  return cn(
    current
      .split(/\s+/)
      .filter((name) => !name.startsWith("fb-") && !owned.has(name)),
    getFunboxBodyClasses(),
    isColorDark(getTheme().bg) && "darkMode",
    getCrt() !== null && "crtmode",
    isFunboxReducedMotionIgnored() && "ignore-reduced-motion",
    isAppLoading() && "loading",
    isFocusCursorHidden() &&
      "cursor-none [&_a]:cursor-none! [&_button]:cursor-none!",
    getMediaQueryDebugLevel() > 0 &&
      `mediaQueryDebugLevel${getMediaQueryDebugLevel()}`,
  );
}
