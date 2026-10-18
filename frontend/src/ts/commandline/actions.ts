import { getCommandlineState } from "../states/commandline";
import { createAccountOwned } from "../../app/account-scope";
import { onCleanup } from "solid-js";
import * as CommandlineLists from "./lists";

import { getMutableConfig } from "../config/store";
import * as AnalyticsController from "../controllers/analytics-controller";

import { CommandWithValidation } from "./types";

import { hide } from "./lifecycle";
import {
  filterSubgroup,
  hideCommands,
  getSubgroup,
  showCommands,
  updateActiveCommand,
} from "./suggestions";
import { hideWarning, createValidationHandler } from "./input-validation";
export async function goBackOrHide(): Promise<void> {
  const commandlineState = getCommandlineState();
  if (commandlineState.mode === "input") {
    commandlineState.mode = "search";
    commandlineState.inputModeParams = {
      command: null,
      placeholder: null,
      value: null,
      icon: null,
    };
    await updateInput("");
    await filterSubgroup();
    await showCommands();
    await updateActiveCommand();
    hideWarning();
    return;
  }

  if (CommandlineLists.getStackLength() > 1) {
    CommandlineLists.popFromStack();
    commandlineState.activeIndex = 0;
    await updateInput("");
    await filterSubgroup();
    await showCommands();
    await updateActiveCommand();
    hideWarning();
  } else {
    hide();
  }
}

const shake = createAccountOwned(() => {
  const state = {
    timeout: undefined as ReturnType<typeof setTimeout> | undefined,
  };
  onCleanup(() => clearTimeout(state.timeout));
  return state;
});

export function handleInputSubmit(): void {
  const commandlineState = getCommandlineState();
  if (commandlineState.isAnimating) return;
  if (commandlineState.inputModeParams.command === null) {
    throw new Error("Can't handle input submit - command is null");
  }

  if (commandlineState.inputModeParams.validation?.status === "checking") {
    //validation ongoing, ignore the submit
    return;
  } else if (commandlineState.inputModeParams.validation?.status === "failed") {
    commandlineState.hasError = true;
    if (shake().timeout !== undefined) {
      clearTimeout(shake().timeout);
    }
    shake().timeout = setTimeout(() => {
      commandlineState.hasError = false;
    }, 500);
    return;
  }

  if ("inputValueConvert" in commandlineState.inputModeParams.command) {
    // withValidation pairs each converter with an executor accepting its output.
    const command = commandlineState.inputModeParams
      .command as CommandWithValidation<unknown>;
    command.exec?.({
      input: command.inputValueConvert(commandlineState.inputValue),
    });
  } else {
    commandlineState.inputModeParams.command.exec?.({
      input: commandlineState.inputValue,
    });
  }

  void AnalyticsController.log("usedCommandLine", {
    command: commandlineState.inputModeParams.command.id,
  });
  hide();
}

export async function runActiveCommand(): Promise<void> {
  const commandlineState = getCommandlineState();
  if (commandlineState.isAnimating) return;
  if (commandlineState.activeCommand === null) return;
  const command = commandlineState.activeCommand;
  if (command.input) {
    const escaped = command.display.split("</i>")[1] ?? command.display;
    commandlineState.mode = "input";
    commandlineState.inputModeParams = {
      command: command,
      placeholder: escaped,
      value: command.defaultValue?.() ?? "",
      icon: command.icon ?? "fa-chevron-right",
    };
    createValidationHandler(command);

    await updateInput(commandlineState.inputModeParams.value as string);
    hideCommands();
  } else if (command.subgroup) {
    CommandlineLists.pushToStack(command.subgroup);
    await updateInput("");
    await filterSubgroup();
    await showCommands();
    await updateActiveCommand();
  } else {
    command.exec?.({});
    if (getMutableConfig().singleListCommandLine === "on") {
      commandlineState.lastSingleListModeInputValue =
        commandlineState.inputValue;
    }
    const isSticky = command.sticky ?? false;
    if (!isSticky) {
      void AnalyticsController.log("usedCommandLine", { command: command.id });
      if (!command.opensModal) {
        hide(true);
      }
    } else {
      await filterSubgroup();
      await showCommands();
      await updateActiveCommand();
    }
  }
}

export async function updateInput(setInput?: string): Promise<void> {
  const commandlineState = getCommandlineState();
  if (setInput !== undefined) commandlineState.inputValue = setInput;

  if (commandlineState.mode === "input") {
    const params = commandlineState.inputModeParams;
    commandlineState.inputIcon = params.icon ?? "fa-search";
    if (params.placeholder !== null) {
      commandlineState.inputPlaceholder = params.placeholder;
    }
    if (params.value !== null) commandlineState.inputValue = params.value;
    commandlineState.selectAll = params.value !== null;
  } else {
    commandlineState.inputIcon = "fa-search";
    commandlineState.inputPlaceholder =
      (await getSubgroup()).title || "Search...";
    commandlineState.selectAll = false;
  }
  commandlineState.selectionNonce++;
}

export function onCommandlineEscape(): void {
  void goBackOrHide();
}

export function onCommandlineBack(): void {
  void goBackOrHide();
}

export function canCommandlineGoBack(): boolean {
  const commandlineState = getCommandlineState();
  return (
    commandlineState.mode === "input" ||
    commandlineState.subgroupStack.length > 1
  );
}
