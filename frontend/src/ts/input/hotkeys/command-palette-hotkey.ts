import { QuickRestart } from "@oxytype/schemas/configs";
import {
  detectPlatform,
  HotkeyChord,
  normalizeHotkey,
  parseHotkey,
  validateHotkey,
} from "@tanstack/solid-hotkeys";

type Platform = "mac" | "windows" | "linux";

export const DEFAULT_COMMAND_PALETTE_HOTKEY: HotkeyChord = "Mod+K";

// always opens the command palette too, regardless of the configured hotkey
export const SECONDARY_COMMAND_PALETTE_HOTKEY: HotkeyChord = "Mod+Shift+P";

// keys that may be used without modifiers because they never type a character
const BARE_KEYS = new Set(["Escape", "Tab", "F2", "F4", "F8", "F9"]);

// keys owned by the quick restart setting
const QUICK_RESTART_KEYS: Partial<Record<QuickRestart, string>> = {
  esc: "Escape",
  tab: "Tab",
  enter: "Enter",
};

// browser, os and text editing shortcuts that must keep working
const RESERVED: Record<string, string> = {
  ...reserve("clipboard and undo", [
    "Mod+A",
    "Mod+C",
    "Mod+V",
    "Mod+X",
    "Mod+Z",
    "Mod+Y",
    "Mod+Shift+Z",
    "Mod+Shift+V",
  ]),
  ...reserve("find", ["Mod+F", "Mod+G", "Mod+Shift+G", "Mod+E", "F3"]),
  ...reserve("reload", ["Mod+R", "Mod+Shift+R", "F5"]),
  ...reserve("tab and window management", [
    "Mod+T",
    "Mod+Shift+T",
    "Mod+N",
    "Mod+Shift+N",
    "Mod+W",
    "Mod+Shift+W",
    "Mod+Q",
    "Mod+M",
    "Mod+H",
    "Mod+Tab",
    "Mod+Shift+Tab",
    "Mod+PageUp",
    "Mod+PageDown",
    "Mod+Shift+[",
    "Mod+Shift+]",
    "Mod+1",
    "Mod+2",
    "Mod+3",
    "Mod+4",
    "Mod+5",
    "Mod+6",
    "Mod+7",
    "Mod+8",
    "Mod+9",
    "F11",
  ]),
  ...reserve("navigation", [
    "Mod+L",
    "Mod+D",
    "Mod+[",
    "Mod+]",
    "Mod+ArrowLeft",
    "Mod+ArrowRight",
    "Mod+ArrowUp",
    "Mod+ArrowDown",
    "Mod+Home",
    "Mod+End",
  ]),
  ...reserve("text editing", [
    "Mod+Backspace",
    "Mod+Delete",
    "Mod+Enter",
    "Mod+Space",
  ]),
  ...reserve("zoom", ["Mod+=", "Mod+-", "Mod+0", "Mod+Shift+="]),
  ...reserve("browser", [
    "Mod+P",
    "Mod+S",
    "Mod+O",
    "Mod+J",
    "Mod+U",
    "Mod+,",
    "Mod+Shift+B",
    "Mod+Shift+O",
    "Mod+Shift+Delete",
    "F1",
    "F6",
    "F7",
    "F10",
  ]),
  ...reserve("developer tools", [
    "Mod+Shift+I",
    "Mod+Shift+J",
    "Mod+Shift+C",
    "Mod+Shift+K",
    "Mod+Alt+I",
    "Mod+Alt+J",
    "Mod+Alt+C",
    "F12",
  ]),
};

function reserve(reason: string, hotkeys: string[]): Record<string, string> {
  return Object.fromEntries(hotkeys.map((hotkey) => [hotkey, reason]));
}

/**
 * Canonical form (e.g. `ctrl+k` -> `Mod+K`) so configs compare and sync cleanly.
 * Invalid hotkeys are returned as is, to be rejected by validation.
 */
export function normalizeCommandPaletteHotkey(
  hotkey: string,
  platform: Platform = detectPlatform(),
): string {
  if (!validateHotkey(hotkey).valid) return hotkey;
  return normalizeHotkey(hotkey, platform);
}

/**
 * Returns why a hotkey can't open the command palette, or undefined if it can.
 */
export function getCommandPaletteHotkeyError(
  hotkey: string,
  quickRestart: QuickRestart,
  platform: Platform = detectPlatform(),
): string | undefined {
  const validation = validateHotkey(hotkey);
  if (!validation.valid) {
    return validation.errors[0] ?? "Invalid shortcut";
  }

  const parsed = parseHotkey(hotkey, platform);
  const normalized = normalizeHotkey(hotkey, platform);
  // physical key codes (e.g. `[KeyK]`) depend on the layout, use logical keys
  const key = parsed.key;
  if (key === undefined) return "Invalid shortcut";

  if (
    parsed.modifiers.length === 0 &&
    QUICK_RESTART_KEYS[quickRestart] === key
  ) {
    return `${key.toLowerCase()} is used by quick restart`;
  }

  const reason = Object.entries(RESERVED).find(
    ([reserved]) => normalizeHotkey(reserved, platform) === normalized,
  )?.[1];
  if (reason !== undefined) {
    return `Shortcut is reserved for ${reason}`;
  }

  // ctrl / cmd combos never type a character. everything else does, apart
  // from a few non character keys
  if (!parsed.ctrl && !parsed.meta) {
    if (parsed.modifiers.length > 0 || !BARE_KEYS.has(key)) {
      return "Shortcut needs ctrl or cmd so it doesn't interfere with typing";
    }
  }

  // the windows / super key is reserved by the os outside of macos
  if (parsed.meta && platform !== "mac") {
    return "Shortcut is reserved for the operating system";
  }

  return undefined;
}
