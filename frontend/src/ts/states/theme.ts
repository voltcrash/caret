import { createAppSignal } from "../../app/state";

import { ColorName, Theme } from "../constants/themes";
import { ThemeName } from "@oxytype/schemas/configs";

export type ThemeIdentifier = ThemeName | "custom";
const defaultTheme: Theme & { name: ThemeIdentifier } = {
  name: "rust",
  bg: "#180d0d",
  main: "#e8692e",
  caret: "#e8692e",
  sub: "#9c867a",
  subAlt: "#271616",
  text: "#f3e7dc",
  error: "#ff4d6d",
  errorExtra: "#b8344f",
  colorfulError: "#ff4d6d",
  colorfulErrorExtra: "#b8344f",
};

export const [getTheme, setTheme] = createAppSignal(defaultTheme);

export function updateThemeColor(key: ColorName, color: string): void {
  setTheme((prev) => ({
    ...prev,
    [key]: color,
  }));
}
