import type { CustomBackgroundFilter } from "@caret/schemas/configs";
import { peekConfig } from "../../config/store";
import { setConfig } from "../../config/setters";
import { Command, CommandsSubgroup } from "../types";

function updateBackgroundFilter(
  index: 0 | 1 | 2 | 3,
  input: string | undefined,
): void {
  if (input === undefined || input.trim() === "") return;
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return;
  const newFilters: CustomBackgroundFilter = [
    ...peekConfig().customBackgroundFilter,
  ];
  newFilters[index] = parsed;
  setConfig("customBackgroundFilter", newFilters);
}

const subgroup: CommandsSubgroup = {
  title: "Custom background filter...",
  configKey: "customBackgroundFilter",
  list: [
    {
      id: "setCustomBackgroundBlur",
      display: "blur...",
      icon: "fa-image",
      input: true,
      defaultValue: (): string => {
        return peekConfig().customBackgroundFilter[0].toString();
      },
      exec: ({ input }): void => {
        updateBackgroundFilter(0, input);
      },
    },
    {
      id: "setCustomBackgroundBrightness",
      display: "brightness...",
      icon: "fa-image",
      input: true,
      defaultValue: (): string => {
        return peekConfig().customBackgroundFilter[1].toString();
      },
      exec: ({ input }): void => {
        updateBackgroundFilter(1, input);
      },
    },
    {
      id: "setCustomBackgroundSaturation",
      display: "saturation...",
      icon: "fa-image",
      input: true,
      defaultValue: (): string => {
        return peekConfig().customBackgroundFilter[2].toString();
      },
      exec: ({ input }): void => {
        updateBackgroundFilter(2, input);
      },
    },
    {
      id: "setCustomBackgroundOpacity",
      display: "opacity...",
      icon: "fa-image",
      input: true,
      defaultValue: (): string => {
        return peekConfig().customBackgroundFilter[3].toString();
      },
      exec: ({ input }): void => {
        updateBackgroundFilter(3, input);
      },
    },
  ],
};

const commands: Command[] = [
  {
    id: "setCustomBackgroundFilter",
    display: "Custom background filter...",
    icon: "fa-image",
    subgroup,
  },
];

export default commands;
