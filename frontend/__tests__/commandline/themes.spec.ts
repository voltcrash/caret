import { createRoot } from "solid-js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { prepareCommandline } from "../../src/ts/commandline/commandline";
import { afterHideCommandline } from "../../src/ts/commandline/lifecycle";
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

vi.mock("../../src/features/typing/runtime/focus", () => ({ set: vi.fn() }));
vi.mock("../../src/ts/ui", () => ({ clearFontPreview: vi.fn() }));

describe("theme picker selection", () => {
  let dispose: () => void;

  beforeEach(async () => {
    vi.useFakeTimers();
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
});
