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
