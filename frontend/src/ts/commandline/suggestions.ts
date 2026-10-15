import { getCommandlineState } from "../states/commandline";
import { captureAccount, createAccountOwned } from "../../app/account-scope";
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

import { isCoarsePointer } from "../utils/pointer";

function removeCommandlineBackground(): void {
  const commandlineState = getCommandlineState();
  commandlineState.noBackground = true;
  if (getMutableConfig().showOutOfFocusWarning) {
    setTestFocusState("focused");
  }
}

export function addCommandlineBackground(): void {
  const commandlineState = getCommandlineState();
  commandlineState.noBackground = false;
  if (!isInputElementFocused()) {
    setTestFocusState("unfocused");
  }
}

export function isBrowsingOnTouch(value: string): boolean {
  return value === "" && isCoarsePointer();
}

export async function filterSubgroup(): Promise<void> {
  const commandlineState = getCommandlineState();
  const lease = captureAccount();
  const subgroup = await getSubgroup();
  if (!lease.isCurrent()) return;
  subgroup.beforeList?.();
  const list = subgroup.list;
  const availability: boolean[] = [];
  for (const command of list) {
    availability.push((await command.available?.()) ?? true);
  }
  if (!lease.isCurrent()) return;
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
  const commandlineState = getCommandlineState();
  commandlineState.suggestions = [];
}

const cache = createAccountOwned(() => ({
  singleSubgroup: null as CommandsSubgroup | null,
}));

export async function getSubgroup(): Promise<CommandsSubgroup> {
  const commandlineState = getCommandlineState();
  const current = cache();
  if (commandlineState.subgroupOverride !== null) {
    return commandlineState.subgroupOverride;
  }

  if (commandlineState.usingSingleList) {
    if (current.singleSubgroup === null) {
      current.singleSubgroup = await CommandlineLists.getSingleSubgroup();
    } else {
      return current.singleSubgroup;
    }
  }

  return CommandlineLists.getTopOfStack();
}

export async function getList(): Promise<Command[]> {
  return (await getSubgroup()).list;
}

export async function showCommands(): Promise<void> {
  const commandlineState = getCommandlineState();
  const lease = captureAccount();
  if (commandlineState.inputValue === "" && commandlineState.usingSingleList) {
    hideCommands();
    return;
  }

  const subgroup = await getSubgroup();

  if (!lease.isCurrent()) return;
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
  const commandlineState = getCommandlineState();
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
  const commandlineState = getCommandlineState();
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
  const commandlineState = getCommandlineState();
  commandlineState.activeIndex--;
  if (commandlineState.activeIndex < 0) {
    commandlineState.activeIndex =
      (await getList()).filter((c) => c.found).length - 1;
  }
  await updateActiveCommand();
}

export function resetSingleSubgroup(): void {
  cache().singleSubgroup = null;
}
