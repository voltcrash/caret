import * as CommandlineLists from "./lists";
import { matchCommands } from "./matching";
import { getMutableConfig } from "../config/store";

import * as ThemeController from "../controllers/theme-controller";
import { clearFontPreview } from "../ui";

import { Command, CommandsSubgroup } from "./types";
import { areUnsortedArraysEqual } from "../utils/arrays";

import { intersect } from "@oxytype/util/arrays";

import { isInputElementFocused } from "../input/input-element";

import { setTestFocusState } from "../states/test";
import { commandlineState } from "../states/commandline";

import { isCoarsePointer } from "../utils/pointer";

function removeCommandlineBackground(): void {
  commandlineState.noBackground = true;
  if (getMutableConfig().showOutOfFocusWarning) {
    setTestFocusState("focused");
  }
}

export function addCommandlineBackground(): void {
  commandlineState.noBackground = false;
  if (!isInputElementFocused()) {
    setTestFocusState("unfocused");
  }
}

export function isBrowsingOnTouch(value: string): boolean {
  return value === "" && isCoarsePointer();
}

export async function filterSubgroup(): Promise<void> {
  const subgroup = await getSubgroup();
  subgroup.beforeList?.();
  const list = subgroup.list;
  const availability: boolean[] = [];
  for (const command of list) {
    availability.push((await command.available?.()) ?? true);
  }
  const found = matchCommands(
    list,
    availability,
    commandlineState.inputValue,
    commandlineState.usingSingleList,
  );
  for (const [index, command] of list.entries()) {
    command.found = found[index] ?? false;
  }
}

export function hideCommands(): void {
  commandlineState.suggestions = [];
}

let cachedSingleSubgroup: CommandsSubgroup | null = null;

export async function getSubgroup(): Promise<CommandsSubgroup> {
  if (commandlineState.subgroupOverride !== null) {
    return commandlineState.subgroupOverride;
  }

  if (commandlineState.usingSingleList) {
    if (cachedSingleSubgroup === null) {
      cachedSingleSubgroup = await CommandlineLists.getSingleSubgroup();
    } else {
      return cachedSingleSubgroup;
    }
  }

  return CommandlineLists.getTopOfStack();
}

export async function getList(): Promise<Command[]> {
  return (await getSubgroup()).list;
}

export async function showCommands(): Promise<void> {
  if (commandlineState.inputValue === "" && commandlineState.usingSingleList) {
    hideCommands();
    return;
  }

  const subgroup = await getSubgroup();

  const list = subgroup.list
    .filter((c) => c.found === true)
    .map((command) => {
      let isActive = false;
      if (command.active !== undefined) {
        isActive = command.active();
      } else {
        const configKey = command.configKey ?? subgroup.configKey;
        if (configKey !== undefined) {
          if (command.configValueMode === "include") {
            if (Array.isArray(command.configValue)) {
              isActive = areUnsortedArraysEqual(
                intersect(
                  getMutableConfig()[configKey] as unknown[],
                  command.configValue,
                ),
                command.configValue,
              );
            } else {
              isActive = (getMutableConfig()[configKey] as unknown[]).includes(
                command.configValue,
              );
            }
          } else {
            isActive = getMutableConfig()[configKey] === command.configValue;
          }
        }
      }

      return { ...command, isActive };
    });

  if (!commandlineState.usingSingleList && commandlineState.inputValue === "") {
    const firstActive = list.findIndex((command) => command.isActive);
    if (firstActive >= 0) commandlineState.activeIndex = firstActive;
  }
  commandlineState.suggestions = list;
}

export async function updateActiveCommand(): Promise<void> {
  if (commandlineState.isAnimating) return;

  const command = commandlineState.suggestions[commandlineState.activeIndex];
  commandlineState.activeCommand = command ?? null;
  if (command === undefined) {
    clearFontPreview();
    void ThemeController.clearPreview();
    addCommandlineBackground();
    return;
  }

  clearFontPreview();
  if (
    command.id.startsWith("changeTheme") ||
    command.id.startsWith("setCustomThemeId")
  ) {
    removeCommandlineBackground();
  } else {
    void ThemeController.clearPreview();
    addCommandlineBackground();
  }
  command.hover?.();
}

export async function incrementActiveIndex(): Promise<void> {
  commandlineState.activeIndex++;
  if (
    commandlineState.activeIndex >=
    (await getList()).filter((c) => c.found).length
  ) {
    commandlineState.activeIndex = 0;
  }
  await updateActiveCommand();
}

export async function decrementActiveIndex(): Promise<void> {
  commandlineState.activeIndex--;
  if (commandlineState.activeIndex < 0) {
    commandlineState.activeIndex =
      (await getList()).filter((c) => c.found).length - 1;
  }
  await updateActiveCommand();
}

export function resetSingleSubgroup(): void {
  cachedSingleSubgroup = null;
}
