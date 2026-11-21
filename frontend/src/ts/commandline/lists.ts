import { createAccountOwned } from "../../app/account-scope";
import { setFixingSkillIssue } from "../states/skill-issue";
import MinBurstCommands from "./lists/min-burst";
import NavigationCommands from "./lists/navigation";
import CustomBackgroundCommands from "./lists/custom-background";
import FontFamilyCommands from "./lists/font-family";
import CustomBackgroundFilterCommands from "./lists/background-filter";
import AddOrRemoveThemeToFavorite from "./lists/add-or-remove-theme-to-favorites";
import TagsCommands from "./lists/tags";
import CustomThemesListCommands from "./lists/custom-themes-list";
import PresetsCommands from "./lists/presets";
import ThemesCommands from "./lists/themes";

import { peekConfig } from "../config/store";
import { setConfig } from "../config/setters";
import { randomizeTheme } from "../controllers/theme-controller";
import { showModal } from "../states/modals";
import {
  showErrorNotification,
  clearAllNotifications,
} from "../states/notifications";
import { Command, CommandlineListKey, CommandsSubgroup } from "./types";
import { COMMAND_SEPARATOR_HTML, buildCommandForConfigKey } from "./util";
import { CommandlineConfigMetadataObject } from "./commandline-metadata";
import { isAuthAvailable, signOut } from "../auth-client";
import { isAuthenticated } from "../states/core";
import { ConfigKey } from "@caret/schemas/configs";
import {
  hideFpsCounter,
  showFpsCounter,
} from "../components/layout/overlays/FpsCounter";
import { applyConfigFromJson } from "../config/lifecycle";
import { commandlineState } from "../states/commandline";
import { contributedCommands, contributedList } from "./registry";

/** Core commands between the slots features contribute to. */
const getCoreCommands = createAccountOwned<
  Record<
    "testScreen" | "accountAndBehavior" | "settings" | "other" | "tools",
    Command[]
  >
>(() => ({
  testScreen: [
    //test screen
    ...buildCommands(
      "punctuation",
      "numbers",
      "mode",
      "time",
      "words",
      "quoteLength",
      "language",
    ),
    {
      id: "changeCustomModeText",
      display: "Change custom text",
      icon: "fa-align-left",
      opensModal: true,
      exec: (): void => {
        showModal("CustomText");
      },
    },
    {
      id: "viewQuoteSearchPopup",
      display: "Search for quotes",
      icon: "fa-search",
      exec: (): void => {
        setConfig("mode", "quote");
        showModal("QuoteSearch");
      },
      shouldFocusTestUI: false,
    },
  ],
  accountAndBehavior: [
    {
      id: "shareTestSettings",
      display: "Share test settings",
      icon: "fa-share",
      exec: (): void => {
        showModal("ShareTestSettings");
      },
    },

    //account
    ...TagsCommands,
    ...PresetsCommands,

    //behavior
    ...buildCommands(
      "resultSaving",
      "difficulty",
      "quickRestart",
      "repeatQuotes",
      "blindMode",
      "alwaysShowWordsHistory",
      "singleListCommandLine",
      "minWpm",
      "minAcc",
      ...MinBurstCommands,
      "britishEnglish",
    ),
  ],
  settings: [
    ...buildCommands("customLayoutfluid", "customPolyglot"),

    //input
    ...buildCommands(
      "freedomMode",
      "strictSpace",
      "oppositeShiftMode",
      "stopOnError",
      "deleteOnError",
      "confidenceMode",
      "quickEnd",
      "indicateTypos",
      "compositionDisplay",
      "hideExtraLetters",
      "lazyMode",
      "layout",
      "codeUnindentOnBackspace",
    ),

    //sound
    ...buildCommands(
      "soundVolume",
      "playSoundOnClick",
      "playSoundOnError",
      "playTimeWarning",
    ),

    //caret
    ...buildCommands(
      "smoothCaret",
      "caretStyle",
      "paceCaret",
      "repeatedPace",
      "paceCaretStyle",
    ),

    //appearence
    ...buildCommands(
      "timerStyle",
      "liveSpeedStyle",
      "liveAccStyle",
      "liveBurstStyle",

      "timerColor",
      "timerOpacity",
      "highlightMode",
      "typedEffect",

      "tapeMode",
      "tapeMargin",
      "smoothLineScroll",
      "showAllLines",
      "typingSpeedUnit",
      "alwaysShowDecimalPlaces",
      "startGraphsAtZero",
      "maxLineWidth",
      "fontSize",
      ...FontFamilyCommands,
      "keymapMode",
      "keymapStyle",
      "keymapLegendStyle",
      "keymapSize",
      "keymapLayout",
      "keymapKeys",
    ),

    //theme
    ...buildCommands(
      ...ThemesCommands,
      "customTheme",

      ...CustomThemesListCommands,
      "flipTestColors",
      "colorfulMode",
      ...AddOrRemoveThemeToFavorite,
      ...CustomBackgroundCommands,
      "customBackgroundSize",
      ...CustomBackgroundFilterCommands,
      "randomTheme",
    ),

    {
      id: "randomizeTheme",
      display: "Next random theme",
      icon: "fa-random",
      exec: async (): Promise<void> => randomizeTheme(),
      available: (): boolean => {
        return peekConfig().randomTheme !== "off";
      },
    },

    //showhide elements
    ...buildCommands(
      "showKeyTips",
      "showOutOfFocusWarning",
      "showTestModesNotice",
      "capsLockWarning",
      "showAverage",
      "showPb",
      "monkeyPowerLevel",
    ),

    //other
  ],
  other: [
    ...NavigationCommands,
    {
      id: "importSettingsJSON",
      display: "Import settings JSON",
      icon: "fa-cog",
      alias: "import config",
      input: true,
      exec: async ({ input }): Promise<void> => {
        if (input === undefined || input === "") return;
        await applyConfigFromJson(input);
      },
    },
    {
      id: "exportSettingsJSON",
      display: "Export settings JSON",
      icon: "fa-cog",
      alias: "export config",
      input: true,
      defaultValue: (): string => {
        return JSON.stringify(peekConfig());
      },
    },
    {
      id: "clearNotifications",
      display: "Clear all notifications",
      icon: "fa-trash-alt",
      alias: "dismiss",
      exec: async (): Promise<void> => {
        clearAllNotifications();
      },
    },
    {
      id: "clearSwCache",
      display: "Clear SW cache",
      icon: "fa-cog",
      exec: async (): Promise<void> => {
        const clist = await caches.keys();
        for (const name of clist) {
          await caches.delete(name);
        }
        window.location.reload();
      },
    },
    {
      id: "getSwCache",
      display: "Get SW cache",
      icon: "fa-cog",
      exec: async (): Promise<void> => {
        alert(await caches.keys());
      },
    },
  ],
  tools: [
    {
      id: "fpsCounter",
      display: "FPS counter...",
      icon: "fa-cog",
      visible: false,
      subgroup: {
        title: "FPS counter...",
        list: [
          {
            id: "startFpsCounter",
            display: "show",
            icon: "fa-cog",
            exec: (): void => {
              showFpsCounter();
            },
          },
          {
            id: "stopFpsCounter",
            display: "hide",
            icon: "fa-cog",
            exec: (): void => {
              hideFpsCounter();
            },
          },
        ],
      },
    },
    {
      id: "fixSkillIssue",
      display: "Fix skill issue",
      icon: "fa-wrench",
      visible: false,
      exec: async (): Promise<void> => {
        setFixingSkillIssue(true);
      },
    },
    {
      id: "openDiscussions",
      display: "Open project discussions",
      icon: "fa-users",
      exec: (): void => {
        window.open("https://github.com/voltcrash/caret/discussions");
      },
    },
    {
      id: "signOut",
      display: "Sign out",
      icon: "fa-sign-out-alt",
      exec: (): void => {
        void signOut();
      },
      available: () => {
        return isAuthAvailable() && isAuthenticated();
      },
    },
  ],
}));

function getCommands(): CommandsSubgroup {
  const core = getCoreCommands();
  return {
    title: "",
    list: [
      ...contributedCommands("result"),
      ...core.testScreen,
      ...contributedCommands("test"),
      ...core.accountAndBehavior,
      ...contributedCommands("behavior"),
      ...core.settings,
      ...contributedCommands("other"),
      ...core.other,
      ...contributedCommands("debug"),
      ...core.tools,
    ],
  };
}

function getLists(): Record<CommandlineListKey, CommandsSubgroup | undefined> {
  return {
    themes: ThemesCommands[0]?.subgroup,
    loadChallenge: contributedList("loadChallenge"),
    minBurst: MinBurstCommands[0]?.subgroup,
    funbox: contributedList("funbox"),
    tags: TagsCommands[0]?.subgroup,
  };
}

function getSubgroupByConfigKey(): Record<string, CommandsSubgroup> {
  return Object.fromEntries(
    getCommands()
      .list.filter((it) => it.subgroup?.configKey !== undefined)
      .map((it) => [it.subgroup?.configKey, it.subgroup]),
  ) as Record<string, CommandsSubgroup>;
}

export function doesListExist(listName: string): boolean {
  if (getSubgroupByConfigKey()[listName] !== undefined) {
    return true;
  }

  return getLists()[listName as CommandlineListKey] !== undefined;
}

export async function getList(
  listName: CommandlineListKey | ConfigKey,
): Promise<CommandsSubgroup> {
  const subGroup = getSubgroupByConfigKey()[listName];
  if (subGroup !== undefined) {
    return subGroup;
  }

  const list = getLists()[listName as CommandlineListKey];
  if (!list) {
    showErrorNotification(`List not found: ${listName}`);
    throw new Error(`List ${listName} not found`);
  }
  return list;
}

export function getStackLength(): number {
  return commandlineState.subgroupStack.length;
}

export function setStackToDefault(): void {
  setStack([getCommands()]);
}

function setStack(val: CommandsSubgroup[]): void {
  commandlineState.subgroupStack = val;
}

export function pushToStack(val: CommandsSubgroup): void {
  commandlineState.subgroupStack.push(val);
}

export function popFromStack(): void {
  commandlineState.subgroupStack.pop();
}

export function getTopOfStack(): CommandsSubgroup {
  const stack = commandlineState.subgroupStack;
  return stack[stack.length - 1] as CommandsSubgroup;
}

export async function getSingleSubgroup(): Promise<CommandsSubgroup> {
  const singleCommands: Command[] = [];
  for (const command of getCommands().list) {
    const ret = buildSingleListCommands(command);
    singleCommands.push(...ret);
  }

  return {
    title: "",
    list: singleCommands,
  };
}

function buildSingleListCommands(
  command: Command,
  parentCommand?: Command,
): Command[] {
  const commands: Command[] = [];
  if (command.subgroup) {
    if (command.subgroup.beforeList) {
      command.subgroup.beforeList();
    }
    const currentCommand = {
      ...command,
      subgroup: {
        ...command.subgroup,
        list: [],
      },
    };
    for (const cmd of command.subgroup.list) {
      commands.push(...buildSingleListCommands(cmd, currentCommand));
    }
  } else {
    if (parentCommand) {
      const parentCommandDisplay = parentCommand.display.replace(
        /\s?\.\.\.$/g,
        "",
      );
      const singleListDisplay = `${
        parentCommandDisplay
      }${COMMAND_SEPARATOR_HTML}${command.display}`;

      const singleListDisplayNoIcon = `${parentCommandDisplay} ${command.display}`;

      let newAlias: string | undefined = undefined;

      if ((parentCommand.alias ?? "") || (command.alias ?? "")) {
        newAlias = [parentCommand.alias, command.alias]
          .filter(Boolean)
          .join(" ");
      }

      const newCommand = {
        ...command,
        singleListDisplay,
        singleListDisplayNoIcon,
        configKey: parentCommand.subgroup?.configKey,
        icon: parentCommand.icon,
        alias: newAlias,
        visible: (parentCommand.visible ?? true) && (command.visible ?? true),
        available: async (): Promise<boolean> => {
          return (
            ((await parentCommand?.available?.()) ?? true) &&
            ((await command?.available?.()) ?? true)
          );
        },
      };
      commands.push(newCommand);
    } else {
      commands.push(command);
    }
  }
  return commands;
}

function buildCommands(
  ...commands: (Command | keyof CommandlineConfigMetadataObject)[]
): Command[] {
  return commands.map((it) =>
    typeof it === "string" ? buildCommandForConfigKey(it) : it,
  );
}
