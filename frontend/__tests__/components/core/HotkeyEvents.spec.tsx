import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vite-plus/test";
const { showModal } = vi.hoisted(() => ({ showModal: vi.fn() }));
vi.mock("../../../src/ts/states/modals", () => ({ showModal }));
vi.mock("../../../src/ts/states/hotkeys", () => ({
  hotkeys: { commandPalette: "Mod+K", quickRestart: "Tab" },
  quickRestartHotkeyMap: { tab: "Tab" },
}));
vi.mock("../../../src/ts/states/test", () => ({
  isLongTest: () => false,
  wordsHaveTab: () => false,
  wordsHaveNewline: () => false,
}));
vi.mock("../../../src/ts/config/store", () => ({
  getConfig: { quickRestart: "tab" },
}));
vi.mock("../../../src/ts/states/overlay-visibility", () => ({
  isAnyPopupVisible: () => false,
}));
vi.mock("../../../src/ts/input/input-element", () => ({
  isInputElementFocused: () => false,
}));
vi.mock("../../../src/ts/states/composition", () => ({ getData: () => "" }));
vi.mock("../../../src/ts/navigation/navigation", () => ({ navigate: vi.fn() }));
import { HotkeyEvents } from "../../../src/ts/components/core/HotkeyEvents";
afterEach(cleanup);

it("unregisters shortcuts on disposal and registers once after remount", () => {
  const press = (): void => {
    fireEvent.keyDown(document, { key: "k", code: "KeyK", ctrlKey: true });
    fireEvent.keyUp(document, { key: "k", code: "KeyK", ctrlKey: true });
  };
  const first = render(() => <HotkeyEvents />);
  press();
  expect(showModal).toHaveBeenCalledExactlyOnceWith("Commandline");
  first.unmount();
  press();
  expect(showModal).toHaveBeenCalledOnce();
  render(() => <HotkeyEvents />);
  press();
  expect(showModal).toHaveBeenCalledTimes(2);
});
