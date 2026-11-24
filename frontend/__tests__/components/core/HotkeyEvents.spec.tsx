import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { detectPlatform } from "@tanstack/solid-hotkeys";
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
vi.mock("../../../src/ts/typing-host", () => ({
  isTypingInputFocused: () => false,
}));
vi.mock("../../../src/ts/states/composition", () => ({ getData: () => "" }));
vi.mock("../../../src/app/navigate", () => ({ navigate: vi.fn() }));
import { HotkeyEvents } from "../../../src/ts/components/core/HotkeyEvents";
afterEach(cleanup);

it("unregisters shortcuts on disposal and registers once after remount", () => {
  const press = (): void => {
    fireEvent.keyDown(document, {
      key: "k",
      code: "KeyK",
      ctrlKey: detectPlatform() !== "mac",
      metaKey: detectPlatform() === "mac",
    });
    fireEvent.keyUp(document, {
      key: "k",
      code: "KeyK",
      ctrlKey: detectPlatform() !== "mac",
      metaKey: detectPlatform() === "mac",
    });
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
