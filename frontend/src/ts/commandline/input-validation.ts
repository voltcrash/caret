import { Command, CommandWithValidation } from "./types";

import { debounce } from "throttle-debounce";

import { useInputValidation } from "../hooks/useInputValidation";

import { commandlineState, type InputModeParams } from "../states/commandline";

function showWarning(message: string): void {
  commandlineState.warning = message;
}

const showCheckingIcon = debounce(200, () => {
  commandlineState.checking = true;
});

function hideCheckingIcon(): void {
  showCheckingIcon.cancel({ upcomingOnly: true });
  commandlineState.checking = false;
}

export function hideWarning(): void {
  commandlineState.warning = null;
}

function updateValidationResult(
  validation: NonNullable<InputModeParams["validation"]>,
): void {
  commandlineState.inputModeParams.validation = validation;
  if (validation.status === "checking") {
    showCheckingIcon();
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
const handlersCache = new Map<string, (e: Event) => Promise<void>>();

export function createValidationHandler(command: Command): void {
  if ("validation" in command && !handlersCache.has(command.id)) {
    const commandWithValidation = command as CommandWithValidation<unknown>;
    const handler = useInputValidation(
      updateValidationResult,
      commandWithValidation.validation,
      "inputValueConvert" in commandWithValidation
        ? commandWithValidation.inputValueConvert
        : undefined,
    );
    handlersCache.set(command.id, handler);
  }
}

export function validateInput(e: Event): void {
  const command = commandlineState.inputModeParams.command;
  if (command === null || !("validation" in command)) return;
  const handler = handlersCache.get(command.id);
  if (handler === undefined) {
    throw new Error(`Expected handler for command ${command.id} is missing`);
  }
  void handler(e);
}
