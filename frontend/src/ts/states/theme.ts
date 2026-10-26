import { createAppSignal } from "../../app/state";

import { ColorName, Theme } from "../constants/themes";
import { ThemeName } from "@oxytype/schemas/configs";

export type ThemeIdentifier = ThemeName | "custom";
const defaultTheme: Theme & { name: ThemeIdentifier } = {
  name: "azure",
  bg: "#0b0d1c",
  main: "#4ea8ff",
  caret: "#4ea8ff",
  sub: "#8290b4",
  subAlt: "#151a30",
  text: "#e4ebff",
  error: "#ff6b5e",
  errorExtra: "#b8423a",
  colorfulError: "#ff6b5e",
  colorfulErrorExtra: "#b8423a",
};

export const [getTheme, setTheme] = createAppSignal(defaultTheme);

export function updateThemeColor(key: ColorName, color: string): void {
  setTheme((prev) => ({
    ...prev,
    [key]: color,
  }));
}
