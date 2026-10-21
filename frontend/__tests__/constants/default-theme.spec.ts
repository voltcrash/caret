import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { getDefaultConfig } from "../../src/ts/constants/default-config";
import {
  DEFAULT_THEME_KEY,
  getBrowserDefaultTheme,
} from "../../src/ts/constants/default-theme";

afterEach(() => {
  localStorage.removeItem(DEFAULT_THEME_KEY);
  vi.restoreAllMocks();
});

describe("getBrowserDefaultTheme", () => {
  it.each([
    [0, "rust"],
    [0.99, "azure"],
  ] as const)("picks at random (%s -> %s) and persists", (roll, theme) => {
    vi.spyOn(Math, "random").mockReturnValue(roll);
    expect(getBrowserDefaultTheme()).toBe(theme);
    expect(localStorage.getItem(DEFAULT_THEME_KEY)).toBe(theme);
  });

  it("keeps the stored pick", () => {
    localStorage.setItem(DEFAULT_THEME_KEY, "azure");
    const random = vi.spyOn(Math, "random");
    expect(getBrowserDefaultTheme()).toBe("azure");
    expect(random).not.toHaveBeenCalled();
  });

  it("re-picks when the stored value is not a flagship theme", () => {
    localStorage.setItem(DEFAULT_THEME_KEY, "serika_dark");
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(getBrowserDefaultTheme()).toBe("rust");
    expect(localStorage.getItem(DEFAULT_THEME_KEY)).toBe("rust");
  });

  it("falls back to rust when storage is unavailable", () => {
    const getItem = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(getBrowserDefaultTheme()).toBe("rust");
    getItem.mockRestore();
  });
});

it("uses the browser pick for the default config theme", () => {
  localStorage.setItem(DEFAULT_THEME_KEY, "azure");
  const config = getDefaultConfig();
  expect(config.theme).toBe("azure");
  expect(config.themeDark).toBe("azure");
  expect(config.themeLight).toBe("serika");
});
