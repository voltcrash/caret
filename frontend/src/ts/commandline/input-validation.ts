import {
  getCommandlineState,
  type InputModeParams,
} from "../states/commandline";
import { captureAccount, createAccountOwned } from "../../app/account-scope";
import { onCleanup } from "solid-js";
import { Command, CommandWithValidation } from "./types";

import { debounce } from "@oxytype/util/timing";

import { useInputValidation } from "../hooks/useInputValidation";

function showWarning(message: string): void {
  const commandlineState = getCommandlineState();
  commandlineState.warning = message;
}

const checkingIcon = createAccountOwned(() => {
  const state = getCommandlineState();
  const show = debounce(200, () => {
    state.checking = true;
  });
  onCleanup(() => show.cancel());
  return show;
});

function hideCheckingIcon(): void {
  const commandlineState = getCommandlineState();
  checkingIcon().cancel({ upcomingOnly: true });
  commandlineState.checking = false;
}

export function hideWarning(): void {
  const commandlineState = getCommandlineState();
  commandlineState.warning = null;
}

function updateValidationResult(
  validation: NonNullable<InputModeParams["validation"]>,
): void {
  const commandlineState = getCommandlineState();
  commandlineState.inputModeParams.validation = validation;
  if (validation.status === "checking") {
    checkingIcon()();
  } else if (
    validation.status === "failed" &&
    validation.errorMessage !== undefined
  ) {
    showWarning(validation.errorMessage);
    hideCheckingIcon();
  } else {
    hideWarning();
    hideCheckingIcon();
  }
}

/*
 * Handlers needs to be created only once per command to ensure they debounce with the given delay
 */
const handlers = createAccountOwned(
  () => new Map<string, (e: Event) => Promise<void>>(),
);

export function createValidationHandler(command: Command): void {
  if ("validation" in command && !handlers().has(command.id)) {
    const commandWithValidation = command as CommandWithValidation<unknown>;
    const lease = captureAccount();
    const handler = useInputValidation(
      (result) => {
        if (lease.isCurrent()) updateValidationResult(result);
      },
      commandWithValidation.validation,
      "inputValueConvert" in commandWithValidation
        ? commandWithValidation.inputValueConvert
        : undefined,
      lease.signal,
    );
    handlers().set(command.id, handler);
  }
}

export function validateInput(e: Event): void {
  const commandlineState = getCommandlineState();
  const command = commandlineState.inputModeParams.command;
  if (command === null || !("validation" in command)) return;
  const handler = handlers().get(command.id);
  if (handler === undefined) {
    throw new Error(`Expected handler for command ${command.id} is missing`);
  }
  void handler(e);
}
