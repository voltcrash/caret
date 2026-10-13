import type {
  HotkeyCallback,
  HotkeyCallbackContext,
} from "@tanstack/solid-hotkeys";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  handler: undefined as HotkeyCallback | undefined,
  inputFocused: false,
  popup: false,
  composition: "",
  callback: vi.fn(),
}));
vi.mock("@tanstack/solid-hotkeys", () => ({
  createHotkey: (_hotkey: unknown, callback: HotkeyCallback) => {
    mocks.handler = callback;
  },
}));
vi.mock("../../../src/ts/states/overlay-visibility", () => ({
  isAnyPopupVisible: () => mocks.popup,
}));
vi.mock("../../../src/ts/input/input-element", () => ({
  isInputElementFocused: () => mocks.inputFocused,
}));
vi.mock("../../../src/ts/states/composition", () => ({
  getData: () => mocks.composition,
}));

import { createHotkey } from "../../../src/ts/input/hotkeys/utils";

let focused: HTMLElement | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks, {
    handler: undefined,
    inputFocused: false,
    popup: false,
    composition: "",
  });
});
afterEach(() => focused?.remove());

function press(hotkey: "Tab" | "Enter" | "Escape"): KeyboardEvent {
  createHotkey(hotkey, mocks.callback);
  const event = new KeyboardEvent("keydown", { key: hotkey, cancelable: true });
  mocks.handler?.(event, { hotkey } as HotkeyCallbackContext);
  return event;
}

describe("hotkey focus guards", () => {
  it.each([
    ["a", ""],
    ["input", ""],
    ["textarea", ""],
    ["select", ""],
    ["button", ""],
    ["div", "button"],
    ["div", "textButton"],
    ["div", "modal"],
  ])("leaves Tab and Enter to focused %s.%s elements", (tag, className) => {
    focused = document.createElement(tag);
    focused.className = className;
    focused.tabIndex = 0;
    document.body.append(focused);
    focused.focus();
    expect(press("Tab").defaultPrevented).toBe(false);
    expect(press("Enter").defaultPrevented).toBe(false);
    expect(mocks.callback).not.toHaveBeenCalled();
  });

  it("handles shortcuts while the words input is focused", () => {
    focused = document.createElement("textarea");
    document.body.append(focused);
    focused.focus();
    mocks.inputFocused = true;
    expect(press("Tab").defaultPrevented).toBe(true);
    expect(mocks.callback).toHaveBeenCalledOnce();
  });

  it("reserves Escape for overlays and composition", () => {
    mocks.popup = true;
    expect(press("Escape").defaultPrevented).toBe(false);
    mocks.popup = false;
    mocks.inputFocused = true;
    mocks.composition = "dead";
    expect(press("Escape").defaultPrevented).toBe(false);
    mocks.composition = "";
    expect(press("Escape").defaultPrevented).toBe(true);
    expect(mocks.callback).toHaveBeenCalledOnce();
  });
});
