import { appObject } from "../../app/state";
import { createAppMemo } from "../../app/application";
import { QuickRestart } from "@caret/schemas/configs";
import { HotkeyChord } from "@tanstack/solid-hotkeys";

import { getConfig } from "../config/store";
import { wordsHaveNewline, wordsHaveTab, isLongTest } from "./test";
import { isTypingRouteActive } from "../../features/typing/scope";
import { NoKey } from "../input/hotkeys/utils";
import {
  DEFAULT_COMMAND_PALETTE_HOTKEY,
  getCommandPaletteHotkeyError,
} from "../input/hotkeys/command-palette-hotkey";

export const quickRestartHotkeyMap: Record<QuickRestart, HotkeyChord> = {
  off: NoKey,
  esc: "Escape",
  tab: "Tab",
  enter: "Enter",
};

type Hotkeys = {
  quickRestart: HotkeyChord;
  commandPalette: HotkeyChord;
};

export const hotkeys = appObject(createAppMemo(updateHotkeys));

function updateHotkeys(): Hotkeys {
  const isOnTestPage = isTypingRouteActive();

  const quickRestartIsTab = getConfig.quickRestart === "tab";
  const quickRestartIsEnter = getConfig.quickRestart === "enter";
  const commandPalette = getCommandPaletteHotkey();

  return {
    quickRestart: shiftHotkey(
      quickRestartHotkeyMap[getConfig.quickRestart],
      isOnTestPage &&
        ((wordsHaveTab() && quickRestartIsTab) ||
          ((wordsHaveNewline() || getConfig.funbox.includes("58008")) &&
            quickRestartIsEnter) ||
          isLongTest()),
    ),
    commandPalette: shiftHotkey(
      commandPalette,
      isOnTestPage && wordsHaveTab() && commandPalette === "Tab",
    ),
  };
}

// the config can come from another platform (or an older client), so fall back
// to the default instead of hijacking a shortcut that is reserved here
function getCommandPaletteHotkey(): HotkeyChord {
  const hotkey = getConfig.commandPaletteHotkey as HotkeyChord;
  if (
    getCommandPaletteHotkeyError(hotkey, getConfig.quickRestart) !== undefined
  ) {
    return DEFAULT_COMMAND_PALETTE_HOTKEY;
  }
  return hotkey;
}

function shiftHotkey(hotkey: HotkeyChord, shift: boolean): HotkeyChord {
  if (shift) {
    if (hotkey === "Tab") return "Shift+Tab";
    if (hotkey === "Enter") return "Shift+Enter";
    if (hotkey === "Escape") return "Shift+Escape";
  }
  return hotkey;
}
