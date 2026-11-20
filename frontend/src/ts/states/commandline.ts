import { createAccountOwned } from "../../app/account-scope";
import { appObject } from "../../app/state";
import { createMutable } from "solid-js/store";
import type { Command, CommandsSubgroup } from "../commandline/types";
import type { ValidationResult } from "../types/validation";

type CommandlineMode = "search" | "input";

export type InputModeParams = {
  command: Command | null;
  placeholder: string | null;
  value: string | null;
  icon: string | null;
  validation?: ValidationResult;
};

export type CommandlineSuggestion = Command & { isActive: boolean };

type CommandlineState = {
  phase: "closed" | "open" | "closing";
  inputValue: string;
  mode: CommandlineMode;
  subgroupStack: CommandsSubgroup[];
  activeIndex: number;
  warning: string | null;
  checking: boolean;
  usingSingleList: boolean;
  activeCommand: Command | null;
  mouseMode: boolean;
  inputModeParams: InputModeParams;
  subgroupOverride: CommandsSubgroup | null;
  lastSingleListModeInputValue: string;
  suggestions: CommandlineSuggestion[];
  inputPlaceholder: string;
  inputIcon: string;
  selectAll: boolean;
  selectionNonce: number;
  noBackground: boolean;
  hasError: boolean;
};

export const getCommandlineState = createAccountOwned(() =>
  createMutable<CommandlineState>({
    phase: "closed",
    inputValue: "",
    mode: "search",
    subgroupStack: [],
    activeIndex: 0,
    warning: null,
    checking: false,
    usingSingleList: false,
    activeCommand: null,
    mouseMode: false,
    inputModeParams: {
      command: null,
      placeholder: "",
      value: "",
      icon: "",
    },
    subgroupOverride: null,
    lastSingleListModeInputValue: "",
    suggestions: [],
    inputPlaceholder: "Search...",
    inputIcon: "fa-search",
    selectAll: false,
    selectionNonce: 0,
    noBackground: false,
    hasError: false,
  }),
);
export const commandlineState = appObject(getCommandlineState);
