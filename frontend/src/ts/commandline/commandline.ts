import { getCommandlineState } from "../states/commandline";
import { captureAccount, createAccountOwned } from "../../app/account-scope";
import { onCleanup } from "solid-js";
import * as Focus from "../../features/typing/runtime/focus";
import * as CommandlineLists from "./lists";

import { getMutableConfig } from "../config/store";

import { showNoticeNotification } from "../states/notifications";
import { getCommandlineSubgroup } from "../states/core";
import { showLoaderBar, hideLoaderBar } from "../states/loader-bar";
import { Command, CommandlineSubgroupKey } from "./types";

import { parseIntOptional } from "../utils/numbers";
import { debounce } from "@oxytype/util/timing";
import { matchesKeyboardEvent } from "@tanstack/solid-hotkeys";

import { hotkeys } from "../states/hotkeys";
import { takePendingSettings } from "./open";

import { hide } from "./lifecycle";
import {
  isBrowsingOnTouch,
  filterSubgroup,
  hideCommands,
  getList,
  showCommands,
  updateActiveCommand,
  incrementActiveIndex,
  decrementActiveIndex,
  resetSingleSubgroup,
} from "./suggestions";
import { createValidationHandler, validateInput } from "./input-validation";
import {
  goBackOrHide,
  handleInputSubmit,
  runActiveCommand,
  updateInput,
} from "./actions";
export { show } from "./open";
export {
  afterHideCommandline,
  onCommandlineBeforeHide,
  onCommandlineBackdropClick,
} from "./lifecycle";
export {
  onCommandlineEscape,
  onCommandlineBack,
  canCommandlineGoBack,
} from "./actions";
export async function prepareCommandline(): Promise<void> {
  const commandlineState = getCommandlineState();
  const lease = captureAccount();
  const settings = takePendingSettings();
  commandlineState.open = true;
  commandlineState.mouseMode = false;
  commandlineState.inputValue = "";
  commandlineState.activeIndex = 0;
  commandlineState.mode = "search";
  resetSingleSubgroup();
  commandlineState.inputModeParams = {
    command: null,
    placeholder: null,
    value: null,
    icon: null,
  };
  const subgroupSignal = getCommandlineSubgroup();

  const overrideStringOrGroup =
    settings?.subgroupOverride ?? subgroupSignal ?? null;

  if (overrideStringOrGroup !== undefined && overrideStringOrGroup !== null) {
    if (typeof overrideStringOrGroup === "string") {
      const exists = CommandlineLists.doesListExist(overrideStringOrGroup);
      if (exists) {
        showLoaderBar();
        commandlineState.subgroupOverride = await CommandlineLists.getList(
          overrideStringOrGroup as CommandlineSubgroupKey,
        );
        hideLoaderBar();
      } else {
        commandlineState.subgroupOverride = null;
        commandlineState.usingSingleList =
          getMutableConfig().singleListCommandLine === "on";
        showNoticeNotification(
          `Command list ${overrideStringOrGroup} not found`,
        );
      }
    } else {
      commandlineState.subgroupOverride = overrideStringOrGroup;
    }
    commandlineState.usingSingleList = false;
  } else {
    commandlineState.subgroupOverride = null;
    commandlineState.usingSingleList =
      getMutableConfig().singleListCommandLine === "on" &&
      !isBrowsingOnTouch("");
  }

  let showInputCommand: Command | undefined = undefined;

  if (settings?.commandOverride !== undefined) {
    const command = (await getList()).find(
      (c) => c.id === settings.commandOverride,
    );
    if (command === undefined) {
      showNoticeNotification(`Command ${settings.commandOverride} not found`);
    } else if (command?.input !== true) {
      showNoticeNotification(
        `Command ${settings.commandOverride} is not an input command`,
      );
    } else {
      showInputCommand = command;
    }
  }

  if (settings?.singleListOverride) {
    commandlineState.usingSingleList = settings.singleListOverride;
  }
  commandlineState.activeCommand = null;
  Focus.set(false);
  CommandlineLists.setStackToDefault();
  await updateInput();
  await filterSubgroup();
  await showCommands();
  await updateActiveCommand();
  setTimeout(() => {
    if (!lease.isCurrent()) return;
    if (showInputCommand) {
      const escaped =
        showInputCommand.display.split("</i>")[1] ?? showInputCommand.display;
      commandlineState.mode = "input";
      commandlineState.inputModeParams = {
        command: showInputCommand,
        placeholder: escaped,
        value: showInputCommand.defaultValue?.() ?? "",
        icon: showInputCommand.icon ?? "fa-chevron-right",
      };
      createValidationHandler(showInputCommand);
      void updateInput(commandlineState.inputModeParams.value as string);
      hideCommands();
    }
  }, 1);
}

const getFilterInput = createAccountOwned(() => {
  const commandlineState = getCommandlineState();
  const filter = debounce(50, async (value: string) => {
    if (commandlineState.isAnimating) return;
    commandlineState.inputValue = value;
    if (commandlineState.subgroupOverride === null) {
      commandlineState.usingSingleList =
        (getMutableConfig().singleListCommandLine === "on" ||
          value.startsWith(">")) &&
        !isBrowsingOnTouch(value);
    }
    if (commandlineState.mode !== "search") return;
    commandlineState.mouseMode = false;
    commandlineState.activeIndex = 0;
    await filterSubgroup();
    await showCommands();
    await updateActiveCommand();
  });
  onCleanup(() => filter.cancel());
  return filter;
});

export function onCommandlineInput(e: Event): void {
  const input = e.target as HTMLInputElement;
  getFilterInput()(input.value);
  validateInput(e);
}

export async function onCommandlineKeyDown(e: KeyboardEvent): Promise<void> {
  const commandlineState = getCommandlineState();
  if (commandlineState.isAnimating) {
    e.preventDefault();
    return;
  }
  // the command palette hotkey also closes it. keys without ctrl / cmd (esc,
  // tab) keep their meaning inside the palette
  if (
    (e.ctrlKey || e.metaKey) &&
    matchesKeyboardEvent(e, hotkeys.commandPalette)
  ) {
    e.preventDefault();
    hide();
    return;
  }
  commandlineState.mouseMode = false;
  if (
    e.key === "ArrowUp" ||
    (e.ctrlKey && (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "p"))
  ) {
    if (
      getMutableConfig().singleListCommandLine === "on" &&
      commandlineState.subgroupOverride === null &&
      commandlineState.inputValue === "" &&
      commandlineState.lastSingleListModeInputValue !== ""
    ) {
      commandlineState.inputValue =
        commandlineState.lastSingleListModeInputValue;
      await updateInput();
      await filterSubgroup();
      await showCommands();
      await updateActiveCommand();
      return;
    }
    e.preventDefault();
    await decrementActiveIndex();
  }
  if (
    e.key === "ArrowDown" ||
    (e.ctrlKey && (e.key.toLowerCase() === "j" || e.key.toLowerCase() === "n"))
  ) {
    e.preventDefault();
    await incrementActiveIndex();
  }
  if (e.key === "Tab") {
    e.preventDefault();
    if (e.shiftKey) {
      await decrementActiveIndex();
    } else {
      await incrementActiveIndex();
    }
  }
  if (e.key === "Enter") {
    e.preventDefault();
    if (commandlineState.mode === "search") {
      await runActiveCommand();
    } else if (commandlineState.mode === "input") {
      handleInputSubmit();
    } else {
      throw new Error("Unknown mode, can't handle enter press");
    }
  }
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    await goBackOrHide();
  }
}

const hover = createAccountOwned(() => ({
  element: undefined as HTMLElement | undefined,
}));

export async function onSuggestionMouseMove(e: MouseEvent): Promise<void> {
  const commandlineState = getCommandlineState();
  commandlineState.mouseMode = true;
  const target = e.target as HTMLElement | null;
  if (target === hover().element) return;
  const dataIndex = parseIntOptional(target?.getAttribute("data-index"));
  if (dataIndex === undefined) return;
  hover().element = target ?? undefined;
  commandlineState.activeIndex = dataIndex;
  await updateActiveCommand();
}

export async function onSuggestionClick(e: MouseEvent): Promise<void> {
  const commandlineState = getCommandlineState();
  const target = e.target as HTMLElement | null;
  const dataIndex = parseIntOptional(target?.getAttribute("data-index"));
  if (dataIndex === undefined) return;
  const previous = commandlineState.activeIndex;
  commandlineState.activeIndex = dataIndex;
  if (previous !== dataIndex) await updateActiveCommand();
  await runActiveCommand();
}
