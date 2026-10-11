import * as Focus from "../test/focus";
import * as CommandlineLists from "./lists";
import { matchCommands } from "./matching";
import { Config } from "../config/store";
import * as AnalyticsController from "../controllers/analytics-controller";
import * as ThemeController from "../controllers/theme-controller";
import { clearFontPreview } from "../ui";
import { showNoticeNotification } from "../states/notifications";
import {
  getActivePage,
  getCommandlineSubgroup,
  setCommandlineSubgroup,
} from "../states/core";
import { showLoaderBar, hideLoaderBar } from "../states/loader-bar";
import {
  Command,
  CommandlineSubgroupKey,
  CommandsSubgroup,
  CommandWithValidation,
} from "./types";
import { areUnsortedArraysEqual } from "../utils/arrays";
import { parseIntOptional } from "../utils/numbers";
import { debounce } from "throttle-debounce";
import { matchesKeyboardEvent } from "@tanstack/solid-hotkeys";
import { intersect } from "@oxytype/util/arrays";
import { useInputValidation } from "../hooks/useInputValidation";
import { isInputElementFocused } from "../input/input-element";
import {
  hideModal as storeHideModal,
  hideModalAndClearChain as storeClearChain,
  showModal,
} from "../states/modals";
import { setTestFocusState } from "../states/test";
import { commandlineState, type InputModeParams } from "../states/commandline";
import { hotkeys } from "../states/hotkeys";
import { isCoarsePointer } from "../utils/pointer";

const MODAL_STORE_ID = "Commandline";

function removeCommandlineBackground(): void {
  commandlineState.noBackground = true;
  if (Config.showOutOfFocusWarning) {
    setTestFocusState("focused");
  }
}

function addCommandlineBackground(): void {
  commandlineState.noBackground = false;
  if (!isInputElementFocused()) {
    setTestFocusState("unfocused");
  }
}

type ShowSettings = {
  subgroupOverride?: CommandsSubgroup | CommandlineSubgroupKey;
  commandOverride?: string;
  singleListOverride?: boolean;
};

let pendingSettings: ShowSettings | undefined;

export function show(settings?: ShowSettings): void {
  pendingSettings = settings;
  showModal(MODAL_STORE_ID);
}

export async function prepareCommandline(): Promise<void> {
  const settings = pendingSettings;
  pendingSettings = undefined;
  commandlineState.open = true;
  commandlineState.mouseMode = false;
  commandlineState.inputValue = "";
  commandlineState.activeIndex = 0;
  commandlineState.mode = "search";
  cachedSingleSubgroup = null;
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
          Config.singleListCommandLine === "on";
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
      Config.singleListCommandLine === "on" && !isBrowsingOnTouch("");
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

function hide(clearModalChain = false): void {
  clearFontPreview();
  void ThemeController.clearPreview();
  commandlineState.isAnimating = true;
  if (clearModalChain) {
    storeClearChain(MODAL_STORE_ID);
  } else {
    storeHideModal(MODAL_STORE_ID);
  }
}

export function afterHideCommandline(): void {
  hideWarning();
  addCommandlineBackground();
  if (getActivePage() !== "test") {
    (document.activeElement as HTMLElement | undefined)?.blur();
  }
  commandlineState.isAnimating = false;
  commandlineState.subgroupOverride = null;
  commandlineState.open = false;
  setCommandlineSubgroup(null);
}

// the single list stays empty until something is typed. touch users often
// have no keyboard open, so they browse the grouped list until they search
function isBrowsingOnTouch(value: string): boolean {
  return value === "" && isCoarsePointer();
}

async function goBackOrHide(): Promise<void> {
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

async function filterSubgroup(): Promise<void> {
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

function hideCommands(): void {
  commandlineState.suggestions = [];
}

let cachedSingleSubgroup: CommandsSubgroup | null = null;

async function getSubgroup(): Promise<CommandsSubgroup> {
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

async function getList(): Promise<Command[]> {
  return (await getSubgroup()).list;
}

async function showCommands(): Promise<void> {
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
                intersect(Config[configKey] as unknown[], command.configValue),
                command.configValue,
              );
            } else {
              isActive = (Config[configKey] as unknown[]).includes(
                command.configValue,
              );
            }
          } else {
            isActive = Config[configKey] === command.configValue;
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

async function updateActiveCommand(): Promise<void> {
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

let shakeTimeout: null | NodeJS.Timeout;

function handleInputSubmit(): void {
  if (commandlineState.isAnimating) return;
  if (commandlineState.inputModeParams.command === null) {
    throw new Error("Can't handle input submit - command is null");
  }

  if (commandlineState.inputModeParams.validation?.status === "checking") {
    //validation ongoing, ignore the submit
    return;
  } else if (commandlineState.inputModeParams.validation?.status === "failed") {
    commandlineState.hasError = true;
    if (shakeTimeout !== null) {
      clearTimeout(shakeTimeout);
    }
    shakeTimeout = setTimeout(() => {
      commandlineState.hasError = false;
    }, 500);
    return;
  }

  if ("inputValueConvert" in commandlineState.inputModeParams.command) {
    commandlineState.inputModeParams.command.exec?.({
      // @ts-expect-error this is fine
      // oxlint-disable-next-line no-unsafe-assignment
      input: commandlineState.inputModeParams.command.inputValueConvert(
        commandlineState.inputValue,
      ),
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

async function runActiveCommand(): Promise<void> {
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
    if (Config.singleListCommandLine === "on") {
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

async function updateInput(setInput?: string): Promise<void> {
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

async function incrementActiveIndex(): Promise<void> {
  commandlineState.activeIndex++;
  if (
    commandlineState.activeIndex >=
    (await getList()).filter((c) => c.found).length
  ) {
    commandlineState.activeIndex = 0;
  }
  await updateActiveCommand();
}

async function decrementActiveIndex(): Promise<void> {
  commandlineState.activeIndex--;
  if (commandlineState.activeIndex < 0) {
    commandlineState.activeIndex =
      (await getList()).filter((c) => c.found).length - 1;
  }
  await updateActiveCommand();
}

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

function hideWarning(): void {
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

function createValidationHandler(command: Command): void {
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

const filterInput = debounce(50, async (value: string) => {
  if (commandlineState.isAnimating) return;
  commandlineState.inputValue = value;
  if (commandlineState.subgroupOverride === null) {
    commandlineState.usingSingleList =
      (Config.singleListCommandLine === "on" || value.startsWith(">")) &&
      !isBrowsingOnTouch(value);
  }
  if (commandlineState.mode !== "search") return;
  commandlineState.mouseMode = false;
  commandlineState.activeIndex = 0;
  await filterSubgroup();
  await showCommands();
  await updateActiveCommand();
});

export function onCommandlineInput(e: Event): void {
  const input = e.target as HTMLInputElement;
  filterInput(input.value);
  const command = commandlineState.inputModeParams.command;
  if (command === null || !("validation" in command)) return;
  const handler = handlersCache.get(command.id);
  if (handler === undefined) {
    throw new Error(`Expected handler for command ${command.id} is missing`);
  }
  void handler(e);
}

export async function onCommandlineKeyDown(e: KeyboardEvent): Promise<void> {
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
      Config.singleListCommandLine === "on" &&
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

let lastHover: HTMLElement | undefined;

export async function onSuggestionMouseMove(e: MouseEvent): Promise<void> {
  commandlineState.mouseMode = true;
  const target = e.target as HTMLElement | null;
  if (target === lastHover) return;
  const dataIndex = parseIntOptional(target?.getAttribute("data-index"));
  if (dataIndex === undefined) return;
  lastHover = target ?? undefined;
  commandlineState.activeIndex = dataIndex;
  await updateActiveCommand();
}

export async function onSuggestionClick(e: MouseEvent): Promise<void> {
  const target = e.target as HTMLElement | null;
  const dataIndex = parseIntOptional(target?.getAttribute("data-index"));
  if (dataIndex === undefined) return;
  const previous = commandlineState.activeIndex;
  commandlineState.activeIndex = dataIndex;
  if (previous !== dataIndex) await updateActiveCommand();
  await runActiveCommand();
}

export function onCommandlineBeforeHide(): void {
  clearFontPreview();
  void ThemeController.clearPreview();
  commandlineState.isAnimating = true;
}

export function onCommandlineBackdropClick(): void {
  hide();
}

export function onCommandlineEscape(): void {
  void goBackOrHide();
}

export function onCommandlineBack(): void {
  void goBackOrHide();
}

export function canCommandlineGoBack(): boolean {
  return (
    commandlineState.mode === "input" ||
    commandlineState.subgroupStack.length > 1
  );
}
