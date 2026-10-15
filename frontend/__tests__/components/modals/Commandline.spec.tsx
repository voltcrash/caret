import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { AnimationParams } from "animejs";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { command, hotkeyHandlers } = vi.hoisted(() => ({
  command: {
    id: "changeThemeAether",
    display: "aether",
    hover: vi.fn(),
    exec: vi.fn(),
  },
  hotkeyHandlers: new Map<string, (event: KeyboardEvent) => void>(),
}));

vi.mock("animejs", () => ({
  animate: (_element: HTMLElement, params: AnimationParams) => {
    queueMicrotask(() => {
      // @ts-expect-error animation callback arguments unused by the lifecycle
      params.onComplete?.();
    });
    return { cancel: vi.fn() };
  },
}));
vi.mock("../../../src/ts/utils/misc", () => ({
  applyReducedMotion: (duration: number) => duration,
}));
vi.mock("../../../src/ts/test/focus", () => ({ set: vi.fn() }));
vi.mock("../../../src/ts/ui", () => ({ clearFontPreview: vi.fn() }));
vi.mock("../../../src/ts/controllers/analytics-controller", () => ({
  log: vi.fn(),
}));
vi.mock("../../../src/ts/controllers/theme-controller", () => ({
  clearPreview: vi.fn(),
}));
vi.mock("../../../src/ts/config/setters", () => ({ setConfig: vi.fn() }));
vi.mock("../../../src/ts/collections/custom-themes", () => ({
  useCustomThemesLiveQuery: () => () => [],
}));
vi.mock("../../../src/ts/commandline/lists", () => {
  const subgroup = { title: "Theme...", list: [command] };
  return {
    doesListExist: () => true,
    getList: async () => subgroup,
    getSingleSubgroup: async () => subgroup,
    getTopOfStack: () => subgroup,
    setStackToDefault: vi.fn(),
    getStackLength: () => 1,
  };
});
vi.mock("../../../src/ts/commandline/util", () => ({
  COMMAND_SEPARATOR_HTML:
    '<i class="fas fa-fw fa-chevron-right chevronIcon"></i>',
}));
vi.mock("../../../src/ts/states/test", () => ({
  setTestFocusState: vi.fn(),
  isLongTest: () => false,
  wordsHaveNewline: () => false,
  wordsHaveTab: () => false,
}));
vi.mock("../../../src/ts/states/hotkeys", () => ({
  hotkeys: { commandPalette: "Mod+K", quickRestart: "Tab" },
  quickRestartHotkeyMap: { off: "", esc: "Escape", tab: "Tab", enter: "Enter" },
}));
vi.mock("../../../src/ts/input/hotkeys/utils", () => ({
  createHotkey: (
    hotkey: string | (() => string),
    callback: (event: KeyboardEvent) => void,
    options?: () => { enabled: boolean },
  ) => {
    if (options?.().enabled === false) return;
    hotkeyHandlers.set(
      typeof hotkey === "function" ? hotkey() : hotkey,
      callback,
    );
  },
}));
vi.mock("../../../src/ts/navigation/navigation", () => ({ navigate: vi.fn() }));

import { show } from "../../../src/ts/commandline/commandline";
import { ThemeIndicator } from "../../../src/ts/components/layout/footer/ThemeIndicator";
import { Commandline } from "../../../src/ts/components/modals/Commandline";
import { getMutableConfig } from "../../../src/ts/config/store";
import { restartTestEvent } from "../../../src/ts/events/test";
import { useCommandPaletteHotkeys } from "../../../src/ts/input/hotkeys/command-palette";
import { useQuickRestartHotkeys } from "../../../src/ts/input/hotkeys/quickrestart";
import { commandlineState } from "../../../src/ts/states/commandline";
import {
  setActivePage,
  setCommandlineSubgroup,
} from "../../../src/ts/states/core";
import { hideModalAndClearChain } from "../../../src/ts/states/modals";
import { isAnyPopupVisible } from "../../../src/ts/states/overlay-visibility";

describe("theme picker lifecycle", () => {
  let displayStyles: HTMLStyleElement;

  beforeEach(() => {
    hideModalAndClearChain("Commandline");
    setCommandlineSubgroup(null);
    setActivePage("test");
    commandlineState.isAnimating = false;
    commandlineState.noBackground = false;
    getMutableConfig().customTheme = false;
    command.id = "changeThemeAether";
    command.display = "aether";
    vi.clearAllMocks();
    useCommandPaletteHotkeys();
    useQuickRestartHotkeys();

    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = false;
    });
    vi.spyOn(HTMLDialogElement.prototype, "getClientRects").mockImplementation(
      function (this: HTMLDialogElement) {
        return {
          length: getComputedStyle(this).display === "none" ? 0 : 1,
        } as DOMRectList;
      },
    );
    HTMLElement.prototype.scrollIntoView = vi.fn();

    displayStyles = document.createElement("style");
    displayStyles.textContent = `
      dialog { display: none; }
      dialog.flex { display: flex; }
      dialog.hidden { display: none; }
      dialog.open\\:flex[open] { display: flex; }
    `;
    document.head.append(displayStyles);
  });

  afterEach(() => {
    cleanup();
    hideModalAndClearChain("Commandline");
    setCommandlineSubgroup(null);
    displayStyles.remove();
    vi.restoreAllMocks();
  });

  it.each([
    [false, "selection"],
    [false, "escape"],
    [false, "backdrop"],
    [true, "selection"],
    [true, "escape"],
    [true, "backdrop"],
  ] as const)(
    "restores shortcuts after closing savedCustomTheme=%s via %s",
    async (savedCustomTheme, dismissal) => {
      if (savedCustomTheme) command.id = "setCustomThemeIdAether";
      const view = render(() => (
        <>
          <ThemeIndicator />
          <Commandline />
        </>
      ));
      const dialog = view.container.querySelector(
        "dialog",
      ) as HTMLDialogElement;
      const restart = vi.fn();
      const unsubscribe = restartTestEvent.subscribe(restart);
      try {
        if (savedCustomTheme) {
          // Saved themes are a command-line subgroup; the custom footer opens
          // the separate on/off setting instead.
          show({
            subgroupOverride: {
              title: "Custom themes list...",
              list: [command],
            },
          });
        } else {
          fireEvent.click(
            view.getByRole("button", {
              name: "Shift-click to toggle custom theme",
            }),
          );
        }
        await waitFor(() => expect(dialog.open).toBe(true));
        expect(commandlineState.noBackground).toBe(true);
        expect(command.hover).toHaveBeenCalled();

        hotkeyHandlers.get("Tab")?.(
          new KeyboardEvent("keydown", { key: "Tab" }),
        );
        expect(restart).not.toHaveBeenCalled();

        if (dismissal === "selection") {
          // Swatch/text children have pointer-events:none in the browser.
          fireEvent.click(
            view.getByText("aether").closest(".command") as HTMLElement,
          );
        } else if (dismissal === "escape") {
          fireEvent.keyDown(view.getByRole("textbox"), { key: "Escape" });
        } else {
          fireEvent.mouseDown(dialog);
        }
        await waitFor(() => expect(commandlineState.open).toBe(false));
        expect(dialog.open).toBe(false);
        expect(commandlineState.isAnimating).toBe(false);
        expect(getComputedStyle(dialog).display).toBe("none");
        expect(isAnyPopupVisible()).toBe(false);
        expect(command.exec).toHaveBeenCalledTimes(
          dismissal === "selection" ? 1 : 0,
        );

        hotkeyHandlers.get("Tab")?.(
          new KeyboardEvent("keydown", { key: "Tab" }),
        );
        expect(restart).toHaveBeenCalledWith({ isQuickRestart: true });
        hotkeyHandlers.get("Mod+K")?.(
          new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
        );
        await waitFor(() => expect(dialog.open).toBe(true));
      } finally {
        unsubscribe();
      }
    },
  );

  it("keeps normal command pickers usable after font preview and selection", async () => {
    command.id = "setFontFamilyRobotoMono";
    command.display = "Roboto Mono";
    const view = render(() => <Commandline />);
    const dialog = view.container.querySelector("dialog") as HTMLDialogElement;
    const settings = {
      subgroupOverride: { title: "Font family...", list: [command] },
    };

    for (let cycle = 0; cycle < 2; cycle++) {
      show(settings);
      await waitFor(() => expect(dialog.open).toBe(true));
      expect(commandlineState.noBackground).toBe(false);
      expect(command.hover).toHaveBeenCalledTimes(cycle + 1);
      fireEvent.click(
        view.getByText("Roboto Mono").closest(".command") as HTMLElement,
      );
      await waitFor(() => expect(commandlineState.open).toBe(false));

      expect(dialog.open).toBe(false);
      expect(isAnyPopupVisible()).toBe(false);
      expect(command.exec).toHaveBeenCalledTimes(cycle + 1);
    }
  });

  it("closes when the command palette hotkey is pressed inside it", async () => {
    const view = render(() => <Commandline />);
    const dialog = view.container.querySelector("dialog") as HTMLDialogElement;

    show({ subgroupOverride: { title: "Font family...", list: [command] } });
    await waitFor(() => expect(dialog.open).toBe(true));

    fireEvent.keyDown(view.getByRole("textbox"), {
      key: "k",
      code: "KeyK",
      // jsdom isn't mac, so mod is ctrl
      ctrlKey: true,
    });
    await waitFor(() => expect(commandlineState.open).toBe(false));
    expect(command.exec).not.toHaveBeenCalled();
  });
});
