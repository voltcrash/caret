import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  restart: vi.fn(),
  navigate: vi.fn(),
  popup: false,
}));

vi.mock("../../../src/ts/config/store", async () => {
  const { createStore } = await import("solid-js/store");
  const [getConfig, setConfigStore] = createStore({
    quickRestart: "tab",
    commandPaletteHotkey: "Mod+K",
    funbox: [],
  });
  return { getConfig, setConfigStore };
});
vi.mock("../../../src/ts/states/test", async () => {
  const { createSignal } = await import("solid-js");
  const [isLongTest, setIsLongTest] = createSignal(false);
  const [wordsHaveTab, setWordsHaveTab] = createSignal(false);
  const [wordsHaveNewline, setWordsHaveNewline] = createSignal(false);
  return {
    isLongTest,
    setIsLongTest,
    wordsHaveTab,
    setWordsHaveTab,
    wordsHaveNewline,
    setWordsHaveNewline,
  };
});
vi.mock("../../../src/ts/states/core", async () => {
  const { createSignal } = await import("solid-js");
  const [getActivePage, setActivePage] = createSignal("test");
  return { getActivePage, setActivePage };
});
vi.mock("../../../src/ts/states/overlay-visibility", () => ({
  isAnyPopupVisible: () => mocks.popup,
}));
vi.mock("../../../src/ts/input/input-element", () => ({
  isInputElementFocused: () => document.activeElement?.id === "wordsInput",
}));
vi.mock("../../../src/ts/states/composition", () => ({ getData: () => "" }));
vi.mock("../../../src/ts/navigation/navigation", () => ({
  navigate: mocks.navigate,
}));
vi.mock("../../../src/ts/events/test", () => ({
  restartTestEvent: { dispatch: mocks.restart },
}));

import { setConfigStore } from "../../../src/ts/config/store";
import { useQuickRestartHotkeys } from "../../../src/ts/input/hotkeys/quickrestart";
import { setActivePage } from "../../../src/ts/states/core";
import {
  setIsLongTest,
  setWordsHaveNewline,
  setWordsHaveTab,
} from "../../../src/ts/states/test";

function Shortcuts(): null {
  useQuickRestartHotkeys();
  return null;
}

function press(key: string, shiftKey = false): boolean {
  const target = document.activeElement ?? document;
  const allowed = fireEvent.keyDown(target, { key, shiftKey });
  fireEvent.keyUp(target, { key, shiftKey });
  return allowed;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.popup = false;
  setConfigStore("quickRestart", "tab");
  setActivePage("test");
  setIsLongTest(false);
  setWordsHaveTab(false);
  setWordsHaveNewline(false);
});
afterEach(cleanup);

it.each([
  ["tab", "Tab"],
  ["esc", "Escape"],
  ["enter", "Enter"],
] as const)("restarts a short test with %s", (setting, key) => {
  setConfigStore("quickRestart", setting);
  render(() => <Shortcuts />);
  expect(press(key)).toBe(false);
  expect(mocks.restart).toHaveBeenCalledExactlyOnceWith({
    isQuickRestart: true,
  });
});

it("updates shortcuts when quick restart changes without remounting", () => {
  render(() => <Shortcuts />);
  expect(press("Tab")).toBe(false);

  setConfigStore("quickRestart", "off");
  expect(press("Tab")).toBe(true);
  expect(press("Enter")).toBe(true);
  expect(press("Escape")).toBe(true);
  expect(mocks.restart).toHaveBeenCalledTimes(1);

  setConfigStore("quickRestart", "enter");
  expect(press("Tab")).toBe(true);
  expect(press("Enter")).toBe(false);
  expect(mocks.restart).toHaveBeenCalledTimes(2);

  setConfigStore("quickRestart", "tab");
  expect(press("Enter")).toBe(true);
  expect(press("Tab")).toBe(false);
  expect(mocks.restart).toHaveBeenCalledTimes(3);
});

it("unregisters quick restart on disposal and registers once after remount", () => {
  const view = render(() => <Shortcuts />);
  press("Tab");
  expect(mocks.restart).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(press("Tab")).toBe(true);
  expect(mocks.restart).toHaveBeenCalledTimes(1);
  render(() => <Shortcuts />);
  press("Tab");
  expect(mocks.restart).toHaveBeenCalledTimes(2);
});

it.each([
  ["tab", "Tab"],
  ["esc", "Escape"],
] as const)(
  "restores %s after switching between short and long tests",
  (setting, key) => {
    setConfigStore("quickRestart", setting);
    render(() => <Shortcuts />);
    for (let cycle = 0; cycle < 2; cycle++) {
      setIsLongTest(true);
      expect(press(key)).toBe(false);
      expect(mocks.restart).toHaveBeenLastCalledWith({ isQuickRestart: true });
      expect(press(key, true)).toBe(false);
      expect(mocks.restart).toHaveBeenLastCalledWith({ isQuickRestart: false });

      setIsLongTest(false);
      expect(press(key)).toBe(false);
      expect(mocks.restart).toHaveBeenLastCalledWith({ isQuickRestart: true });
    }
    expect(mocks.restart).toHaveBeenCalledTimes(6);
  },
);

it("reserves Shift+Enter for bail out in long tests", () => {
  setConfigStore("quickRestart", "enter");
  render(() => <Shortcuts />);
  setIsLongTest(true);
  expect(press("Enter", true)).toBe(true);
  expect(mocks.restart).not.toHaveBeenCalled();
  expect(press("Enter")).toBe(false);
  expect(mocks.restart).toHaveBeenCalledExactlyOnceWith({
    isQuickRestart: true,
  });
  setIsLongTest(false);
  expect(press("Enter")).toBe(false);
  expect(mocks.restart).toHaveBeenCalledTimes(2);
});
