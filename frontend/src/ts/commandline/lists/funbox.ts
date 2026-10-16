import * as Funbox from "../../../features/typing/runtime/funbox/funbox";
import * as TestLogic from "../../../features/typing/runtime/test-logic";
import { getAllFunboxes, checkCompatibility } from "@oxytype/funbox";
import { Command, CommandsSubgroup } from "../types";
import { getActiveFunboxNames } from "../../../features/typing/runtime/funbox/list";

const list: Command[] = [
  {
    id: "changeFunboxNone",
    display: "none",
    configValue: "none",
    alias: "off",
    sticky: true,
    exec: (): void => {
      if (Funbox.setFunbox([])) {
        void TestLogic.restart();
      }
    },
  },
];

for (const funbox of getAllFunboxes()) {
  list.push({
    id: `changeFunbox${funbox.name}`,
    display: funbox.name.replace(/_/g, " "),
    available: () => {
      const activeNames = getActiveFunboxNames();
      if (activeNames.includes(funbox.name)) return true;
      return checkCompatibility(activeNames, funbox.name);
    },
    sticky: true,
    alias: funbox.alias,
    configValue: funbox.name,
    configValueMode: "include",
    exec: (): void => {
      Funbox.toggleFunbox(funbox.name);
      void TestLogic.restart();
    },
  });
}

const subgroup: CommandsSubgroup = {
  title: "Funbox...",
  configKey: "funbox",
  list,
};

const commands: Command[] = [
  {
    id: "changeFunbox",
    display: "Funbox...",
    alias: "fun box",
    icon: "fa-gamepad",
    subgroup,
  },
];

export default commands;
