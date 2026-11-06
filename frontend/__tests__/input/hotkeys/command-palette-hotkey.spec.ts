import { describe, expect, it } from "vite-plus/test";
import {
  getCommandPaletteHotkeyError,
  normalizeCommandPaletteHotkey,
} from "../../../src/ts/input/hotkeys/command-palette-hotkey";

describe("getCommandPaletteHotkeyError", () => {
  describe.for(["mac", "windows", "linux"] as const)("on %s", (platform) => {
    it.for(["Mod+K", "Mod+Shift+L", "Mod+Alt+P", "Mod+/", "Escape", "Tab"])(
      "allows %s",
      (hotkey) => {
        expect(
          getCommandPaletteHotkeyError(hotkey, "off", platform),
        ).toBeUndefined();
      },
    );

    it.for([
      "Mod+F",
      "Mod+C",
      "Mod+V",
      "Mod+R",
      "Mod+T",
      "Mod+W",
      "Mod+L",
      "Mod+Backspace",
      "Mod+Shift+I",
      "Mod+1",
      "F5",
      "F12",
    ])("rejects reserved %s", (hotkey) => {
      expect(getCommandPaletteHotkeyError(hotkey, "off", platform)).toMatch(
        /reserved/,
      );
    });

    it.for([
      "K",
      "Shift+K",
      "Alt+K",
      "Space",
      "Enter",
      "Backspace",
      "Shift+Tab",
    ])("rejects %s because it interferes with typing", (hotkey) => {
      expect(getCommandPaletteHotkeyError(hotkey, "off", platform)).toMatch(
        /ctrl or cmd/,
      );
    });

    it("rejects the quick restart key", () => {
      expect(getCommandPaletteHotkeyError("Tab", "tab", platform)).toBe(
        "tab is used by quick restart",
      );
      expect(getCommandPaletteHotkeyError("Escape", "esc", platform)).toBe(
        "escape is used by quick restart",
      );
      expect(getCommandPaletteHotkeyError("Tab", "esc", platform)).toBe(
        undefined,
      );
      expect(getCommandPaletteHotkeyError("tab", "tab", platform)).toBe(
        "tab is used by quick restart",
      );
    });

    it("rejects invalid hotkeys", () => {
      expect(
        getCommandPaletteHotkeyError("Foo+K", "off", platform),
      ).toBeDefined();
    });
  });

  it("matches literal modifiers against mod", () => {
    expect(getCommandPaletteHotkeyError("Meta+F", "off", "mac")).toMatch(
      /reserved/,
    );
    expect(getCommandPaletteHotkeyError("Control+F", "off", "windows")).toMatch(
      /reserved/,
    );
    // ctrl + f is not find on mac
    expect(
      getCommandPaletteHotkeyError("Control+F", "off", "mac"),
    ).toBeUndefined();
  });

  it("rejects the windows key outside of mac", () => {
    expect(getCommandPaletteHotkeyError("Meta+K", "off", "windows")).toMatch(
      /operating system/,
    );
    expect(getCommandPaletteHotkeyError("Meta+K", "off", "linux")).toMatch(
      /operating system/,
    );
  });
});

describe("normalizeCommandPaletteHotkey", () => {
  it("normalizes aliases and casing", () => {
    expect(normalizeCommandPaletteHotkey("ctrl+k", "windows")).toBe("Mod+K");
    expect(normalizeCommandPaletteHotkey("cmd+shift+k", "mac")).toBe(
      "Mod+Shift+K",
    );
    expect(normalizeCommandPaletteHotkey("tab", "linux")).toBe("Tab");
    expect(normalizeCommandPaletteHotkey("ctrl+pageup", "linux")).toBe(
      "Mod+PageUp",
    );
  });

  it("leaves invalid hotkeys untouched", () => {
    expect(normalizeCommandPaletteHotkey("foo+bar", "mac")).toBe("foo+bar");
  });
});
