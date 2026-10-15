import { createAccountOwned } from "../../../app/account-scope";
import { appObject } from "../../../app/state";
import { setConfig } from "../../config/setters";
import { isAuthenticated } from "../../states/core";
import * as CustomThemes from "../../collections/custom-themes";
import * as ThemeController from "../../controllers/theme-controller";
import { Command, CommandsSubgroup } from "../types";

const getSubgroup = createAccountOwned<CommandsSubgroup>(() => ({
  title: "Custom themes list...",
  // configKey: "customThemeId",
  beforeList: (): void => update(),
  list: [],
}));

const commands = appObject(
  createAccountOwned<Command[]>(() => [
    {
      id: "setCustomThemeId",
      display: "Custom themes...",
      icon: "fa-palette",
      subgroup: getSubgroup(),
      available: (): boolean => {
        return isAuthenticated();
      },
    },
  ]),
  true,
);

function update(): void {
  getSubgroup().list = [];
  if (!isAuthenticated()) {
    return;
  }

  const customThemes = CustomThemes.getCustomThemes();
  for (const theme of customThemes) {
    getSubgroup().list.push({
      id: `setCustomThemeId${theme._id}`,
      display: theme.name.replace(/_/gi, " "),
      configValue: theme._id,
      hover: (): void => {
        ThemeController.preview("custom", theme.colors);
      },
      exec: (): void => {
        setConfig("customTheme", true);
        setConfig("customThemeColors", theme.colors);
      },
    });
  }
}

export default commands;
