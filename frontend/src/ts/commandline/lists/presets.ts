import { createAccountOwned } from "../../../app/account-scope";
import { appObject } from "../../../app/state";
import * as PresetController from "../../controllers/preset-controller";
import { isAuthenticated } from "../../states/core";
import { Command, CommandsSubgroup } from "../types";
import { getPresets } from "../../collections/presets";
import { showModal } from "../../states/modals";

const getSubgroup = createAccountOwned<CommandsSubgroup>(() => ({
  title: "Presets...",
  list: [],
  beforeList: (): void => {
    update();
  },
}));

const commands = appObject(
  createAccountOwned<Command[]>(() => [
    {
      visible: false,
      id: "applyPreset",
      display: "Presets...",
      icon: "fa-sliders-h",
      subgroup: getSubgroup(),
      available: (): boolean => {
        return isAuthenticated();
      },
    },
  ]),
  true,
);

function update(): void {
  const presets = getPresets();
  getSubgroup().list = [];
  if (presets.length === 0) return;
  presets.forEach((preset) => {
    getSubgroup().list.push({
      id: `applyPreset${preset._id}`,
      display: preset.name,
      exec: async (): Promise<void> => {
        await PresetController.apply(preset._id);
      },
    });
  });
  getSubgroup().list.push({
    id: "createPreset",
    display: "Create preset",
    icon: "fa-plus",
    exec: (): void => {
      showModal("AddPresetModal");
    },
  });
}

export default commands;
