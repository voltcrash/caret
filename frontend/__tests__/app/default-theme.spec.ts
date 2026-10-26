import { afterEach, expect, it, vi } from "vite-plus/test";

import { getDefaultConfig } from "../../src/ts/constants/default-config";

afterEach(() => {
  vi.restoreAllMocks();
});

it("defaults every browser to azure", () => {
  const random = vi.spyOn(Math, "random");
  const config = getDefaultConfig();
  expect(config.theme).toBe("azure");
  expect(config.themeDark).toBe("azure");
  expect(config.themeLight).toBe("serika");
  expect(config.customThemeColors[0]).toBe("#0b0d1c");
  expect(random).not.toHaveBeenCalled();
});
