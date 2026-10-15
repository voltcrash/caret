import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { createRoot } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import "../../../__harness__/mock-static";
import { AutoSwitchTheme } from "../../../../src/ts/components/pages/settings/custom-setting/AutoSwitchTheme";
import { CustomBackground } from "../../../../src/ts/components/pages/settings/custom-setting/CustomBackground";
import { FontFamily } from "../../../../src/ts/components/pages/settings/custom-setting/FontFamily";
import { Theme } from "../../../../src/ts/components/pages/settings/custom-setting/Theme";
import * as Persistence from "../../../../src/ts/config/persistence";
import { setConfig } from "../../../../src/ts/config/setters";
import { getConfig, setFullConfigStore } from "../../../../src/ts/config/store";
import { __testing } from "../../../../src/ts/config/testing";
import { getDefaultConfig } from "../../../../src/ts/constants/default-config";
import {
  useThemeEvents,
  applyCustomBackground,
} from "../../../../src/ts/controllers/theme-controller";
import { getFontFace, getFontFamily } from "../../../../src/ts/states/app";
import { getBackground } from "../../../../src/ts/states/background";
import { getTheme } from "../../../../src/ts/states/theme";
import { applyFontFamily } from "../../../../src/ts/ui";
import FileStorage from "../../../../src/ts/utils/file-storage";
import * as JsonData from "../../../../src/ts/utils/json-data";

// Rendering every theme button makes these tests slow enough to time out on CI.
vi.mock("../../../../src/ts/constants/themes", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../../src/ts/constants/themes")
    >();
  const used = new Set(["serika", "serika_dark", "aether"]);
  return {
    ...actual,
    ThemesList: actual.ThemesList.filter((theme) => used.has(theme.name)),
  };
});

// Keep FileStorage's reactive notifications; replace only its IndexedDB backend.
vi.mock("idb", () => {
  const files = new Map<string, string>();
  return {
    openDB: async () => ({
      get: async (_store: string, key: string) => files.get(key),
      put: async (_store: string, value: string, key: string) =>
        files.set(key, value),
      delete: async (_store: string, key: string) => files.delete(key),
    }),
  };
});

let disposeEvents: () => void;
beforeEach(async () => {
  disposeEvents = createRoot((dispose) => {
    useThemeEvents();
    return dispose;
  });
  __testing.replaceConfig({});
  setFullConfigStore(getDefaultConfig());
  const save = Persistence.saveToLocalStorage;
  vi.spyOn(Persistence, "saveToLocalStorage").mockImplementation((key) =>
    save(key, false, true),
  );
  vi.spyOn(JsonData, "getLanguage").mockResolvedValue({
    name: "english",
    words: ["test"],
  });
  await FileStorage.deleteFile("LocalBackgroundFile");
  await FileStorage.deleteFile("LocalFontFamilyFile");
});

afterEach(() => {
  disposeEvents();
  cleanup();
  vi.restoreAllMocks();
});

it("removes a local background and restores the URL and sizing defaults", async () => {
  setConfig("customBackground", "https://example.com/image.png");
  setConfig("customBackgroundSize", "contain");
  await FileStorage.storeFile(
    "LocalBackgroundFile",
    "data:image/png;base64,local",
  );
  await applyCustomBackground();
  const view = render(() => <CustomBackground />);
  await waitFor(() =>
    expect(
      view.getByRole("button", { name: "remove local background" }),
    ).toBeInTheDocument(),
  );

  fireEvent.click(view.getByRole("button", { name: "Reset to default" }));
  await waitFor(() => {
    expect(getConfig.customBackground).toBe("");
    expect(getConfig.customBackgroundSize).toBe("cover");
    expect(getBackground().url).toBe("");
    expect(view.getByPlaceholderText("image url")).toHaveValue("");
    expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
  });
  expect(await FileStorage.hasFile("LocalBackgroundFile")).toBe(false);
});

it("offers reset for a local font even when the config font is default", async () => {
  await FileStorage.storeFile(
    "LocalFontFamilyFile",
    "data:font/woff2;base64,local",
  );
  await applyFontFamily();
  const view = render(() => <FontFamily />);
  await waitFor(() =>
    expect(
      view.getByRole("button", { name: "Reset to default" }),
    ).toBeInTheDocument(),
  );

  fireEvent.click(view.getByRole("button", { name: "Reset to default" }));
  await waitFor(() => {
    expect(getFontFace()).toBe("");
    expect(getFontFamily()).toContain('"Roboto Mono"');
    expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
    expect(
      view.queryByRole("button", { name: "remove local font" }),
    ).toBeNull();
  });
  expect(await FileStorage.hasFile("LocalFontFamilyFile")).toBe(false);
});

it("restores the preset even when only inactive custom colors were modified", async () => {
  const defaults = getDefaultConfig();
  const colors = defaults.customThemeColors;
  colors[0] = "#000000";
  setConfig("customThemeColors", colors);
  const view = render(() => <Theme />);

  fireEvent.click(view.getByRole("button", { name: "Reset to default" }));
  await waitFor(() => {
    expect(getConfig.theme).toBe(defaults.theme);
    expect(getConfig.customTheme).toBe(false);
    expect(getConfig.customThemeColors).toEqual(
      getDefaultConfig().customThemeColors,
    );
    expect(getTheme().name).toBe(defaults.theme);
    expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
  });
});

it("restores both automatic themes even when switching is disabled", async () => {
  setConfig("themeLight", "aether");
  setConfig("themeDark", "aether");
  const view = render(() => <AutoSwitchTheme />);
  fireEvent.click(view.getByRole("button", { name: "Reset to default" }));
  await waitFor(() => {
    expect(getConfig.autoSwitchTheme).toBe(false);
    expect(getConfig.themeLight).toBe(getDefaultConfig().themeLight);
    expect(getConfig.themeDark).toBe(getDefaultConfig().themeDark);
    expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
  });
});

it("does not apply a pending color-picker edit after resetting the theme", async () => {
  const defaults = getDefaultConfig();
  setConfig("customTheme", true);
  const view = render(() => <Theme />);
  const color = await waitFor(() => {
    const input = view.container.querySelector<HTMLInputElement>(
      'input[type="color"]',
    );
    if (input === null) throw new Error("Color picker not rendered");
    return input;
  });
  fireEvent.input(color, { target: { value: "#000000" } });
  fireEvent.click(view.getByRole("button", { name: "Reset to default" }));

  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(getTheme().bg).toBe(defaults.customThemeColors[0]);
  expect(getConfig.customTheme).toBe(false);
  expect(view.queryByRole("button", { name: "Reset to default" })).toBeNull();
});
