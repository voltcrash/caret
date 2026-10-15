import { ThemeName } from "@oxytype/schemas/configs";
import { getMutableConfig } from "../../config/store";
import { setConfig } from "../../config/setters";
import { randomTheme } from "../../controllers/theme-controller";
import { Command } from "../types";

const commands: Command[] = [
  {
    id: "addThemeToFavorite",
    display: "Add current theme to favorite",
    icon: "fa-star",
    available: (): boolean => {
      return (
        !getMutableConfig().customTheme &&
        !getMutableConfig().favThemes.includes(
          (randomTheme as ThemeName) ?? getMutableConfig().theme,
        )
      );
    },
    exec: (): void => {
      const { theme, favThemes, customTheme } = getMutableConfig();
      const themeToUpdate = randomTheme ?? theme;
      if (!customTheme && !favThemes.includes(themeToUpdate as ThemeName)) {
        setConfig("favThemes", [...favThemes, themeToUpdate as ThemeName]);
      }
    },
  },
  {
    id: "removeThemeFromFavorite",
    display: "Remove current theme from favorite",
    icon: "fa-star",
    iconType: "regular",
    available: (): boolean => {
      return (
        !getMutableConfig().customTheme &&
        getMutableConfig().favThemes.includes(
          (randomTheme as ThemeName) ?? getMutableConfig().theme,
        )
      );
    },
    exec: (): void => {
      const { theme, favThemes, customTheme } = getMutableConfig();
      const themeToUpdate = (randomTheme as ThemeName) ?? theme;
      if (!customTheme && favThemes.includes(themeToUpdate)) {
        setConfig("favThemes", [
          ...favThemes.filter((t) => t !== themeToUpdate),
        ]);
      }
    },
  },
];

export default commands;
