import { describe, it, expect, beforeEach, afterAll, vi } from "vite-plus/test";
import * as Config from "../../src/ts/config/setters";
import * as Lifecycle from "../../src/ts/config/lifecycle";
import * as ConfigUtils from "../../src/ts/config/utils";
import { __testing } from "../../src/ts/config/testing";
import {
  ConfigKey,
  Config as ConfigType,
  CaretStyleSchema,
} from "@oxytype/schemas/configs";
import * as FunboxValidation from "../../src/ts/config/funbox-validation";
import * as ConfigValidation from "../../src/ts/config/validation";
import { configEvent } from "../../src/ts/events/config";
import * as RemoteConfig from "../../src/ts/config/sync";
import * as Notifications from "../../src/ts/states/notifications";
import * as TestState from "../../src/ts/states/test";
import { getConfig as getConfigStore } from "../../src/ts/config/store";

const { replaceConfig, getConfig } = __testing;

describe("Config", () => {
  beforeEach(() => {
    replaceConfig({});
  });

  it("extracts changed scalar and collection settings without mutating config", () => {
    replaceConfig({
      mode: "words",
      words: 0,
      showKeyTips: false,
      funbox: ["no_quit"],
    });
    const previous = structuredClone(getConfig());
    expect(ConfigUtils.getConfigChanges()).toMatchObject({
      mode: "words",
      words: 0,
      showKeyTips: false,
      funbox: ["no_quit"],
    });
    expect(getConfig()).toEqual(previous);
  });

  describe("test with mocks", () => {
    const canSetConfigWithCurrentFunboxesMock = vi.spyOn(
      FunboxValidation,
      "canSetConfigWithCurrentFunboxes",
    );
    const isConfigValueValidMock = vi.spyOn(
      ConfigValidation,
      "isConfigValueValid",
    );
    const dispatchConfigEventMock = vi.spyOn(configEvent, "dispatch");
    const dbSaveConfigMock = vi.spyOn(RemoteConfig, "saveConfig");
    const notificationAddMock = vi.spyOn(
      Notifications,
      "showNoticeNotification",
    );
    const miscTriggerResizeMock = vi.spyOn(window, "dispatchEvent");
    const stateIsTestActiveMock = vi.spyOn(TestState, "isTestActive");

    const mocks = [
      canSetConfigWithCurrentFunboxesMock,
      isConfigValueValidMock,
      dispatchConfigEventMock,
      dbSaveConfigMock,
      notificationAddMock,
      miscTriggerResizeMock,
      stateIsTestActiveMock,
    ];

    beforeEach(async () => {
      vi.useFakeTimers();
      mocks.forEach((it) => it.mockClear());

      isConfigValueValidMock.mockReturnValue(true);
      canSetConfigWithCurrentFunboxesMock.mockReturnValue(true);
      dbSaveConfigMock.mockResolvedValue();
      stateIsTestActiveMock.mockReturnValue(true);

      replaceConfig({});
    });

    afterAll(() => {
      mocks.forEach((it) => it.mockRestore());
      vi.useRealTimers();
    });

    it("should throw if config key in not found in metadata", () => {
      expect(() => {
        Config.setConfig("nonExistentKey" as ConfigKey, true);
      }).toThrow(`Config metadata for key "nonExistentKey" is not defined.`);
    });

    it("fails if test is active and funbox no_quit", () => {
      //GIVEN
      replaceConfig({ funbox: ["no_quit"], numbers: false });

      //WHEN
      expect(
        Config.setConfig("numbers", true, {
          nosave: true,
        }),
      ).toBe(false);

      //THEN
      expect(notificationAddMock).toHaveBeenCalledWith(
        "No quit funbox is active. Please finish the test.",
        {
          important: true,
        },
      );
    });

    it.each(["letter", "word"] as const)(
      "leaves config and effects untouched when showAllLines is blocked in %s tape mode",
      async (tapeMode) => {
        replaceConfig({ tapeMode, showAllLines: false });
        const previous = structuredClone(getConfig());
        const previousStoredValue = getConfigStore.showAllLines;
        expect(Config.setConfig("showAllLines", true)).toBe(false);
        expect(getConfig()).toEqual(previous);
        expect(getConfigStore.showAllLines).toBe(previousStoredValue);
        expect(notificationAddMock).toHaveBeenCalledWith(
          "Show all lines doesn't support tape mode.",
        );
        expect(dispatchConfigEventMock).not.toHaveBeenCalled();
        expect(miscTriggerResizeMock).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(2500);
        expect(dbSaveConfigMock).not.toHaveBeenCalled();
      },
    );

    it("allows disabling showAllLines in tape mode", () => {
      replaceConfig({ tapeMode: "word", showAllLines: true });
      expect(Config.setConfig("showAllLines", false)).toBe(true);
      expect(getConfig().showAllLines).toBe(false);
      expect(notificationAddMock).not.toHaveBeenCalled();
      expect(dispatchConfigEventMock).toHaveBeenCalledWith({
        key: "showAllLines",
        newValue: false,
        previousValue: true,
        nosave: false,
      });
    });

    it("blocks reserved command palette hotkeys", () => {
      //WHEN / THEN
      expect(Config.setConfig("commandPaletteHotkey", "Mod+F")).toBe(false);
      expect(getConfig().commandPaletteHotkey).toBe("Mod+K");
      expect(notificationAddMock).toHaveBeenCalledWith(
        "Shortcut is reserved for find",
      );
    });

    it("blocks the quick restart key as command palette hotkey", () => {
      //GIVEN
      replaceConfig({ quickRestart: "tab" });

      //WHEN / THEN
      expect(Config.setConfig("commandPaletteHotkey", "Tab")).toBe(false);
      expect(Config.setConfig("commandPaletteHotkey", "Escape")).toBe(true);
    });

    it("normalizes the command palette hotkey", () => {
      //WHEN
      Config.setConfig("commandPaletteHotkey", "alt+mod+p");

      //THEN
      expect(getConfig().commandPaletteHotkey).toBe("Mod+Alt+P");
    });

    it("resets the command palette hotkey when quick restart takes its key", () => {
      //GIVEN
      replaceConfig({ quickRestart: "off", commandPaletteHotkey: "Escape" });

      //WHEN
      expect(Config.setConfig("quickRestart", "esc")).toBe(true);

      //THEN
      expect(getConfig()).toMatchObject({
        quickRestart: "esc",
        commandPaletteHotkey: "Mod+K",
      });
      expect(notificationAddMock).toHaveBeenCalled();
    });

    it("keeps the command palette hotkey when quick restart doesn't conflict", () => {
      //GIVEN
      replaceConfig({ quickRestart: "off", commandPaletteHotkey: "Escape" });

      //WHEN
      expect(Config.setConfig("quickRestart", "tab")).toBe(true);

      //THEN
      expect(getConfig().commandPaletteHotkey).toBe("Escape");
      expect(notificationAddMock).not.toHaveBeenCalled();
    });

    it("disables live text stats when enabling monkey", () => {
      //GIVEN
      replaceConfig({
        liveSpeedStyle: "text",
        liveAccStyle: "text",
        monkey: false,
      });

      //WHEN / THEN
      expect(Config.setConfig("monkey", true)).toBe(true);
      expect(getConfig()).toMatchObject({
        monkey: true,
        liveSpeedStyle: "mini",
        liveAccStyle: "mini",
      });
      expect(notificationAddMock).not.toHaveBeenCalled();
    });

    it("disables monkey when enabling live speed text", () => {
      //GIVEN
      replaceConfig({ monkey: true, liveSpeedStyle: "off" });

      //WHEN / THEN
      expect(Config.setConfig("liveSpeedStyle", "text")).toBe(true);
      expect(getConfig()).toMatchObject({
        monkey: false,
        liveSpeedStyle: "text",
      });
      expect(notificationAddMock).not.toHaveBeenCalled();
    });

    it("disables monkey when enabling live accuracy text", () => {
      //GIVEN
      replaceConfig({ monkey: true, liveAccStyle: "off" });

      //WHEN / THEN
      expect(Config.setConfig("liveAccStyle", "text")).toBe(true);
      expect(getConfig()).toMatchObject({
        monkey: false,
        liveAccStyle: "text",
      });
      expect(notificationAddMock).not.toHaveBeenCalled();
    });

    it("should use overrideValue", () => {
      //WHEN
      Config.setConfig("customLayoutfluid", ["3l", "ABNT2", "3l"]);

      //THEN
      expect(getConfig().customLayoutfluid).toEqual(["3l", "ABNT2"]);
    });

    it("fails if config is invalid", () => {
      //GIVEN
      isConfigValueValidMock.mockReturnValue(false);

      //WHEN / THEN
      expect(Config.setConfig("caretStyle", "banana" as any)).toBe(false);
      expect(isConfigValueValidMock).toHaveBeenCalledWith(
        "caret style",
        "banana",
        CaretStyleSchema,
      );
    });

    it("cannot set if funbox disallows", () => {
      //GIVEN
      canSetConfigWithCurrentFunboxesMock.mockReturnValue(false);

      //WHEN / THEN
      expect(Config.setConfig("numbers", true)).toBe(false);
    });

    it("sets overrideConfigs", () => {
      //GIVEN
      replaceConfig({
        confidenceMode: "off",
        freedomMode: false, //already set correctly
        stopOnError: "letter", //should get updated
      });

      //WHEN
      Config.setConfig("confidenceMode", "max");

      //THEN
      expect(dispatchConfigEventMock).not.toHaveBeenCalledWith({
        key: "freedomMode",
        newValue: false,
        nosave: true,
        previousValue: true,
      });

      expect(dispatchConfigEventMock).toHaveBeenCalledWith({
        key: "stopOnError",
        newValue: "off",
        nosave: false,
        previousValue: "letter",
      });

      expect(dispatchConfigEventMock).toHaveBeenCalledWith({
        key: "confidenceMode",
        newValue: "max",
        nosave: false,
        previousValue: "off",
      });
    });

    it("saves to localstorage if nosave=false", async () => {
      //GIVEN
      replaceConfig({ numbers: false });

      //WHEN
      Config.setConfig("numbers", true);

      //THEN
      //wait for debounce
      await vi.advanceTimersByTimeAsync(2500);

      //save
      expect(dbSaveConfigMock).toHaveBeenCalledWith({ numbers: true });
    });

    it("saves configOverride values to localstorage if nosave=false", async () => {
      //GIVEN
      replaceConfig({});

      //WHEN
      Config.setConfig("minWpmCustomSpeed", 120);

      //THEN
      //wait for debounce
      await vi.advanceTimersByTimeAsync(2500);

      //save
      expect(dbSaveConfigMock).toHaveBeenCalledWith({
        minWpmCustomSpeed: 120,
        minWpm: "custom",
      });
    });

    it("does not save to localstorage if nosave=true", async () => {
      //GIVEN

      replaceConfig({ numbers: false });

      //WHEN
      Config.setConfig("numbers", true, {
        nosave: true,
      });

      //THEN
      //wait for debounce
      await vi.advanceTimersByTimeAsync(2500);

      expect(dbSaveConfigMock).not.toHaveBeenCalled();
    });

    it("dispatches event on set", () => {
      //GIVEN
      replaceConfig({ numbers: false });

      //WHEN
      Config.setConfig("numbers", true, {
        nosave: true,
      });

      //THEN

      expect(dispatchConfigEventMock).toHaveBeenCalledWith({
        key: "numbers",
        newValue: true,
        nosave: true,
        previousValue: false,
      });
    });

    it("triggers resize if property is set", () => {
      ///WHEN
      Config.setConfig("maxLineWidth", 50);

      expect(miscTriggerResizeMock).toHaveBeenCalled();
    });

    it("does not triggers resize if property is not set", () => {
      ///WHEN
      Config.setConfig("startGraphsAtZero", true);

      expect(miscTriggerResizeMock).not.toHaveBeenCalled();
    });

    it("does not triggers resize if property on nosave", () => {
      ///WHEN
      Config.setConfig("maxLineWidth", 50, { nosave: true });

      expect(miscTriggerResizeMock).not.toHaveBeenCalled();
    });
  });

  describe("apply", () => {
    it.each(["[]", "null", "42", "not JSON"])(
      "rejects invalid JSON %s without changing settings",
      async (json) => {
        replaceConfig({ theme: "nord", time: 60 });
        const original = structuredClone(getConfig());
        const errorMock = vi.spyOn(Notifications, "showErrorNotification");
        const consoleMock = vi
          .spyOn(console, "error")
          .mockImplementation(() => undefined);
        try {
          expect(await Lifecycle.applyConfigFromJson(json)).toBe(false);
          expect(getConfig()).toEqual(original);
          expect(errorMock).toHaveBeenCalled();
        } finally {
          errorMock.mockRestore();
          consoleMock.mockRestore();
        }
      },
    );

    it("cleans imported settings and keeps exports clean after reimport", async () => {
      const saveConfigMock = vi
        .spyOn(RemoteConfig, "saveConfig")
        .mockResolvedValue();
      const successMock = vi.spyOn(Notifications, "showSuccessNotification");
      const errorMock = vi.spyOn(Notifications, "showErrorNotification");

      try {
        await Lifecycle.applyConfigFromJson(
          JSON.stringify({
            ads: "result",
            monkey: true,
            caretStyle: "banana",
            paceCaretStyle: "monkey",
            unknownSetting: true,
            quickTab: true,
            theme: "miami_nights",
            language: "english_10k",
            fontFamily: "Mononoki",
            favThemes: ["nord", "serika_dark"],
            monkeyPowerLevel: "3",
            liveSpeedStyle: "text",
            liveAccStyle: "text",
            showPb: true,
            burstHeatmap: true,
            accountChart: ["on", "off", "on", "off"],
          }),
        );

        const supportedSettings = {
          caretStyle: "default",
          paceCaretStyle: "default",
          quickRestart: "tab",
          theme: "miami_nights",
          language: "english_10k",
          fontFamily: "Mononoki",
          favThemes: ["nord", "serika_dark"],
          monkeyPowerLevel: "3",
          liveSpeedStyle: "text",
          liveAccStyle: "text",
          showPb: true,
          burstHeatmap: true,
          accountChart: ["on", "off", "on", "off"],
        };
        expect(getConfig()).toMatchObject({
          ...supportedSettings,
          monkey: false,
        });
        expect(getConfig()).not.toHaveProperty("ads");
        expect(getConfigStore).not.toHaveProperty("ads");
        expect(getConfigStore).toMatchObject(supportedSettings);
        expect(saveConfigMock).toHaveBeenCalledWith(getConfig());
        expect(errorMock).not.toHaveBeenCalled();

        const json = ConfigUtils.exportConfigToJson();
        const exported = JSON.parse(json) as Partial<ConfigType>;
        expect(exported).toMatchObject(supportedSettings);
        for (const key of ["ads", "monkey", "unknownSetting", "quickTab"]) {
          expect(exported).not.toHaveProperty(key);
        }

        await Lifecycle.applyConfigFromJson(json);
        expect(ConfigUtils.exportConfigToJson()).toBe(json);
        expect(successMock).toHaveBeenCalledTimes(2);
        expect(errorMock).not.toHaveBeenCalled();
      } finally {
        saveConfigMock.mockRestore();
        successMock.mockRestore();
        errorMock.mockRestore();
      }
    });

    it("should fill missing values with defaults", async () => {
      //GIVEN
      replaceConfig({
        mode: "words",
      });
      await Lifecycle.applyConfig({
        numbers: true,
        punctuation: true,
      });
      const config = getConfig();
      expect(config.mode).toBe("time");
      expect(config.numbers).toBe(true);
      expect(config.punctuation).toBe(true);
    });

    describe("should reset to default if setting failed", () => {
      const testCases: {
        display: string;
        value: Partial<ConfigType>;
        expected: Partial<ConfigType>;
      }[] = [
        {
          // invalid funbox
          display: "invalid funbox",
          value: { funbox: ["invalid_funbox"] as any },
          expected: { funbox: [] },
        },
        {
          display: "mode incompatible with funbox",
          value: { mode: "quote", funbox: ["58008"] },
          expected: { funbox: [] },
        },
        {
          display: "invalid combination of funboxes",
          value: { funbox: ["58008", "gibberish"] },
          expected: { funbox: [] },
        },
        {
          display: "sanitizes config, remove extra keys",
          value: { mode: "zen", unknownKey: true, unknownArray: [1, 2] } as any,
          expected: { mode: "zen" },
        },
        {
          display: "applies config migration",
          value: { mode: "zen", swapEscAndTab: true } as any,
          expected: { mode: "zen", quickRestart: "esc" },
        },
      ];

      it.each(testCases)("$display", async ({ value, expected }) => {
        await Lifecycle.applyConfig(value);

        const config = getConfig();
        const applied = Object.fromEntries(
          Object.entries(config).filter(([key]) =>
            Object.keys(expected).includes(key),
          ),
        );
        expect(applied).toEqual(expected);
      });
    });

    describe("should apply keys in an order to avoid overrides", () => {
      const testCases: {
        display: string;
        value: Partial<ConfigType>;
        expected: Partial<ConfigType>;
      }[] = [
        {
          display:
            "quote length shouldnt override mode, punctuation and numbers",
          value: {
            punctuation: true,
            numbers: true,
            quoteLength: [0],
            mode: "time",
          },
          expected: {
            punctuation: true,
            numbers: true,
            quoteLength: [0],
            mode: "time",
          },
        },
      ];

      it.each(testCases)("$display", async ({ value, expected }) => {
        await Lifecycle.applyConfig(value);
        const config = getConfig();
        const applied = Object.fromEntries(
          Object.entries(config).filter(([key]) =>
            Object.keys(expected).includes(key),
          ),
        );
        expect(applied).toEqual(expected);
      });
    });

    it("should apply a partial config but keep the rest unchanged", async () => {
      replaceConfig({
        numbers: true,
      });
      await Lifecycle.applyConfig({
        ...ConfigUtils.getConfigChanges(),
        punctuation: true,
      });
      const config = getConfig();
      expect(config.numbers).toBe(true);
    });

    it("should not enable minWpm if not provided", async () => {
      replaceConfig({
        minWpm: "off",
      });
      await Lifecycle.applyConfig({
        minWpmCustomSpeed: 100,
      });
      const config = getConfig();
      expect(config.minWpm).toBe("off");
      expect(config.minWpmCustomSpeed).toEqual(100);
    });

    it("should apply minWpm if part of the full config", async () => {
      replaceConfig({
        minWpm: "off",
      });
      await Lifecycle.applyConfig({
        minWpm: "custom",
        minWpmCustomSpeed: 100,
      });
      const config = getConfig();
      expect(config.minWpm).toBe("custom");
      expect(config.minWpmCustomSpeed).toEqual(100);
    });

    it("should keep the keymap off when applying keymapLayout", async () => {
      replaceConfig({});
      await Lifecycle.applyConfig({
        keymapLayout: "qwerty",
      });
      const config = getConfig();
      expect(config.keymapLayout).toEqual("qwerty");
      expect(config.keymapMode).toEqual("off");
    });
  });
});
