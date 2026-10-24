import { createRoot } from "solid-js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import {
  onCommandlineInput,
  onCommandlineKeyDown,
  prepareCommandline,
} from "../../src/ts/commandline/commandline";
import {
  afterHideCommandline,
  onCommandlineBackdropClick,
} from "../../src/ts/commandline/lifecycle";
import { setConfig } from "../../src/ts/config/setters";
import { getMutableConfig } from "../../src/ts/config/store";
import { getDefaultConfig } from "../../src/ts/constants/default-config";
import * as ThemeController from "../../src/ts/controllers/theme-controller";
import { commandlineState } from "../../src/ts/states/commandline";
import {
  getThemeIndicator,
  setCommandlineSubgroup,
} from "../../src/ts/states/core";
import { getTheme } from "../../src/ts/states/theme";
import * as Arrays from "../../src/ts/utils/arrays";

vi.mock("../../src/features/typing/runtime/focus", () => ({ set: vi.fn() }));
vi.mock("../../src/ts/ui", async (original) => ({
  ...(await original<typeof import("../../src/ts/ui")>()),
  clearFontPreview: vi.fn(),
}));

describe("theme picker selection", () => {
  let dispose: () => void;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(Arrays, "shuffle").mockImplementation(() => undefined);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    dispose = createRoot((disposeRoot) => {
      ThemeController.useThemeEvents();
      return disposeRoot;
    });
    Object.assign(getMutableConfig(), getDefaultConfig(), {
      theme: "aether",
      favThemes: ["matrix"],
    });
    commandlineState.isAnimating = false;
    setCommandlineSubgroup("themes");
    setConfig("randomTheme", "fav", { nosave: true });
    await ThemeController.randomizeTheme();
    await vi.advanceTimersByTimeAsync(0);
  });

  afterEach(async () => {
    await ThemeController.clearPreview(false);
    setConfig("randomTheme", "off", { nosave: true });
    await vi.advanceTimersByTimeAsync(0);
    afterHideCommandline();
    dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the random theme when opening the picker", async () => {
    expect(getTheme().name).toBe("matrix");

    await prepareCommandline();
    await vi.advanceTimersByTimeAsync(250);

    expect(getTheme().name).toBe("matrix");
    expect(getThemeIndicator().text).toBe("matrix");
    expect(commandlineState.activeCommand?.configValue).toBe("matrix");
    expect(
      commandlineState.suggestions.filter((command) => command.isActive),
    ).toMatchObject([{ configValue: "matrix" }]);
    expect(getMutableConfig().theme).toBe("aether");
    expect(getMutableConfig().randomTheme).toBe("fav");
  });

  it.each(["on", "dark", "light", "auto"] as const)(
    "keeps the current theme with random mode %s",
    async (mode) => {
      setConfig("randomTheme", mode, { nosave: true });
      await ThemeController.randomizeTheme();
      const currentTheme = getTheme().name;
      expect(currentTheme).not.toBe("aether");

      await prepareCommandline();
      await vi.advanceTimersByTimeAsync(250);

      expect(getTheme().name).toBe(currentTheme);
      expect(commandlineState.activeCommand?.configValue).toBe(currentTheme);
      expect(
        commandlineState.suggestions.filter((command) => command.isActive),
      ).toMatchObject([{ configValue: currentTheme }]);
      expect(getMutableConfig().theme).toBe("aether");
      expect(getMutableConfig().randomTheme).toBe(mode);
    },
  );

  it.each(["off", "on"] as const)(
    "uses the saved theme in mode %s before any random theme is applied",
    async (mode) => {
      setConfig("randomTheme", "off", { nosave: true });
      await vi.advanceTimersByTimeAsync(0);
      setConfig("randomTheme", mode, { nosave: true });

      await prepareCommandline();
      await vi.advanceTimersByTimeAsync(250);

      expect(getTheme().name).toBe("aether");
      expect(getThemeIndicator().text).toBe("aether");
      expect(commandlineState.activeCommand?.configValue).toBe("aether");
      expect(
        commandlineState.suggestions.filter((command) => command.isActive),
      ).toMatchObject([{ configValue: "aether" }]);
    },
  );

  it.each(["escape", "backdrop"] as const)(
    "restores the random theme after browsing and closing via %s",
    async (dismissal) => {
      await prepareCommandline();
      await vi.advanceTimersByTimeAsync(250);
      await onCommandlineKeyDown(
        new KeyboardEvent("keydown", { key: "ArrowDown" }),
      );
      await vi.advanceTimersByTimeAsync(250);
      expect(getTheme().name).not.toBe("matrix");
      expect(getMutableConfig().theme).toBe("aether");

      if (dismissal === "escape") {
        await onCommandlineKeyDown(
          new KeyboardEvent("keydown", { key: "Escape" }),
        );
      } else {
        onCommandlineBackdropClick();
      }
      await vi.advanceTimersByTimeAsync(250);

      expect(getTheme().name).toBe("matrix");
      expect(getThemeIndicator().text).toBe("matrix");
      expect(getMutableConfig().theme).toBe("aether");
      expect(getMutableConfig().randomTheme).toBe("fav");
    },
  );

  it.each(["aether", "serika"] as const)(
    "applies manual selection %s while random mode remains enabled",
    async (theme) => {
      await prepareCommandline();
      const input = document.createElement("input");
      input.addEventListener("input", onCommandlineInput);
      input.value = theme;
      input.dispatchEvent(new Event("input"));
      await vi.advanceTimersByTimeAsync(300);
      expect(commandlineState.activeCommand?.configValue).toBe(theme);

      await onCommandlineKeyDown(
        new KeyboardEvent("keydown", { key: "Enter" }),
      );
      await vi.advanceTimersByTimeAsync(250);

      expect(getTheme().name).toBe(theme);
      expect(getThemeIndicator().text).toBe(theme);
      expect(getMutableConfig().theme).toBe(theme);
      expect(getMutableConfig().randomTheme).toBe("fav");
      expect(ThemeController.randomTheme).toBeNull();
    },
  );

  it("follows subsequent random themes when reopening the picker", async () => {
    for (const theme of ["matrix", "serika", "8008"] as const) {
      setConfig("favThemes", [theme], { nosave: true });
      setConfig("randomTheme", "fav", { nosave: true });
      await ThemeController.randomizeTheme();
      setCommandlineSubgroup("themes");

      await prepareCommandline();
      await vi.advanceTimersByTimeAsync(250);

      expect(getTheme().name).toBe(theme);
      expect(commandlineState.activeCommand?.configValue).toBe(theme);
      expect(
        commandlineState.suggestions.filter((command) => command.isActive),
      ).toMatchObject([{ configValue: theme }]);
      expect(getMutableConfig().theme).toBe("aether");

      onCommandlineBackdropClick();
      await vi.advanceTimersByTimeAsync(0);
      afterHideCommandline();
    }
  });
});

// Browser module exports are sealed; register spies before imports run.
vi.mock("../../src/ts/utils/arrays", { spy: true });
