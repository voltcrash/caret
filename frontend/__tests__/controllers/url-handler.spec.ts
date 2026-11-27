import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { Difficulty, Mode, Mode2 } from "@caret/schemas/shared";
import { compressToURI } from "lz-ts";
import * as UpdateConfig from "../../src/ts/config/setters";
import * as Notifications from "../../src/ts/states/notifications";
import * as TestLogic from "../../src/features/typing/runtime/test/logic";
import * as QuoteSelection from "../../src/features/typing/state/quote-selection";
import * as Misc from "../../src/ts/utils/misc";
import { CustomTextSettings } from "@caret/schemas/results";
import {
  applyUrlSettings,
  loadTestSettingsFromUrl,
} from "../../src/features/typing/runtime/url-handler";

//mock modules to avoid dependencies
vi.mock("../../src/features/typing/runtime/test/logic", () => ({
  restart: vi.fn(),
}));

describe("url-handler", () => {
  describe("loadTestSettingsFromUrl", () => {
    const findGetParameterMock = vi.spyOn(Misc, "findGetParameter");

    const setConfigMock = vi.spyOn(UpdateConfig, "setConfig");
    const setSelectedQuoteIdMock = vi.spyOn(
      QuoteSelection,
      "setSelectedQuoteId",
    );
    const restartTestMock = vi.spyOn(TestLogic, "restart");
    const notifySuccessMock = vi.spyOn(
      Notifications,
      "showSuccessNotification",
    );
    const notifyMock = vi.spyOn(Notifications, "showNoticeNotification");

    beforeEach(() => {
      [
        setConfigMock,
        findGetParameterMock,
        setSelectedQuoteIdMock,
        restartTestMock,
        notifySuccessMock,
        notifyMock,
      ].forEach((it) => it.mockClear());

      findGetParameterMock.mockImplementation((override) => override);
    });

    it("handles null", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue("null");

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(setConfigMock).not.toHaveBeenCalled();
    });
    it("handles mode2 as number", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(
        urlData({ mode: "time", mode2: 60 }),
      );

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(setConfigMock).toHaveBeenCalledWith("mode", "time", {
        nosave: true,
      });
      expect(setConfigMock).toHaveBeenCalledWith("time", 60, {
        nosave: true,
      });
      expect(restartTestMock).toHaveBeenCalled();
    });
    it("sets time", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(
        urlData({ mode: "time", mode2: "30" }),
      );

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(setConfigMock).toHaveBeenCalledWith("mode", "time", {
        nosave: true,
      });
      expect(setConfigMock).toHaveBeenCalledWith("time", 30, {
        nosave: true,
      });
      expect(restartTestMock).toHaveBeenCalled();
    });
    it("sets word count", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(
        urlData({ mode: "words", mode2: "50" }),
      );

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(setConfigMock).toHaveBeenCalledWith("mode", "words", {
        nosave: true,
      });
      expect(setConfigMock).toHaveBeenCalledWith("words", 50, {
        nosave: true,
      });
      expect(restartTestMock).toHaveBeenCalled();
    });
    it("sets quote length", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(
        urlData({ mode: "quote", mode2: "512" }),
      );

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(setConfigMock).toHaveBeenCalledWith("mode", "quote", {
        nosave: true,
      });
      expect(setConfigMock).toHaveBeenCalledWith("quoteLength", [-2], {
        nosave: true,
      });
      expect(setSelectedQuoteIdMock).toHaveBeenCalledWith(512);
      expect(restartTestMock).toHaveBeenCalled();
    });
    it("sets punctuation", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(urlData({ punctuation: true }));

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(setConfigMock).toHaveBeenCalledWith("punctuation", true, {
        nosave: true,
      });
      expect(restartTestMock).toHaveBeenCalled();
    });
    it("sets numbers", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(urlData({ numbers: false }));

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(setConfigMock).toHaveBeenCalledWith("numbers", false, {
        nosave: true,
      });
      expect(restartTestMock).toHaveBeenCalled();
    });
    it("sets language", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(urlData({ language: "english" }));

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(setConfigMock).toHaveBeenCalledWith("language", "english", {
        nosave: true,
      });
      expect(restartTestMock).toHaveBeenCalled();
    });
    it("sets difficulty", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(urlData({ difficulty: "master" }));

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(setConfigMock).toHaveBeenCalledWith("difficulty", "master", {
        nosave: true,
      });
      expect(restartTestMock).toHaveBeenCalled();
    });
    it("sets funbox", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(
        urlData({ funbox: ["crt", "choo_choo"] }),
      );

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(setConfigMock).toHaveBeenCalledWith(
        "funbox",
        ["crt", "choo_choo"],
        {
          nosave: true,
        },
      );
      expect(restartTestMock).toHaveBeenCalled();
    });
    it("sets funbox legacy", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(
        urlData({ funbox: "crt#choo_choo" }),
      );

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(setConfigMock).toHaveBeenCalledWith(
        "funbox",
        ["crt", "choo_choo"],
        {
          nosave: true,
        },
      );
      expect(restartTestMock).toHaveBeenCalled();
    });
    it("adds notification", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(
        urlData({
          mode: "time",
          mode2: "60",
          customText: {
            text: ["abcabc"],
            limit: { value: 5, mode: "time" },
            mode: "random",
            pipeDelimiter: true,
          },
          punctuation: true,
          numbers: true,
          language: "english",
          difficulty: "master",
          funbox: ["ascii", "crt"],
        }),
      );

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(notifySuccessMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          "Settings applied from URL:",
          "",
          "mode: time",
          "mode2: 60",
        ]),
        {
          durationMs: 10000,
        },
      );
    });
    it("rejects invalid values", () => {
      //GIVEN
      findGetParameterMock.mockReturnValue(
        urlData({
          mode: "invalidMode",
          mode2: "invalidMode2",
          customText: {
            text: "invalid",
            limit: "invalid",
            mode: "invalid",
            pipeDelimiter: "invalid",
          },
          punctuation: "invalid",
          numbers: "invalid",
          language: "invalid",
          difficulty: "invalid",
          funbox: ["invalid"],
        } as any),
      );

      //WHEN
      loadTestSettingsFromUrl("");

      //THEN
      expect(notifyMock).toHaveBeenCalledWith(
        `Failed to load test settings from URL: JSON does not match schema: "0" invalid enum value. expected 'time' | 'words' | 'quote' | 'custom' | 'zen', received 'invalidmode', "1" needs to be a number or a number represented as a string e.g. "10"., "2.mode" invalid enum value. expected 'repeat' | 'random' | 'shuffle', received 'invalid', "2.pipeDelimiter" expected boolean, received string, "2.limit" expected object, received string, "2.text" expected array, received string, "3" expected boolean, received string, "4" expected boolean, received string, "6" invalid enum value. expected 'normal' | 'expert' | 'master', received 'invalid'`,
      );
    });

    it("skips unknown language/funbox per field while applying remaining settings", () => {
      findGetParameterMock.mockReturnValue(
        urlData({
          mode: "time",
          mode2: "30",
          language: "not_a_real_language",
          funbox: "crt#not_a_funbox",
        }),
      );
      loadTestSettingsFromUrl("");
      expect(notifyMock).not.toHaveBeenCalled();
      expect(setConfigMock).toHaveBeenCalledWith("mode", "time", {
        nosave: true,
      });
      expect(setConfigMock).toHaveBeenCalledWith("time", 30, {
        nosave: true,
      });
      expect(setConfigMock).not.toHaveBeenCalledWith(
        "language",
        expect.anything(),
        expect.anything(),
      );
      expect(setConfigMock).not.toHaveBeenCalledWith(
        "funbox",
        expect.anything(),
        expect.anything(),
      );
      expect(restartTestMock).toHaveBeenCalled();

      setConfigMock.mockClear();
      restartTestMock.mockClear();
      findGetParameterMock.mockReturnValue(
        urlData({
          mode: "words",
          mode2: "25",
          funbox: ["not_a_funbox"],
        }),
      );
      loadTestSettingsFromUrl("");
      expect(setConfigMock).toHaveBeenCalledWith("mode", "words", {
        nosave: true,
      });
      expect(setConfigMock).toHaveBeenCalledWith("words", 25, {
        nosave: true,
      });
      expect(setConfigMock).not.toHaveBeenCalledWith(
        "funbox",
        expect.anything(),
        expect.anything(),
      );
      expect(restartTestMock).toHaveBeenCalled();
    });

    it("maps legacy funbox 'none' to an empty array and applies remaining settings", () => {
      findGetParameterMock.mockReturnValue(
        urlData({
          mode: "time",
          mode2: "15",
          funbox: "none",
        }),
      );
      loadTestSettingsFromUrl("");
      expect(notifyMock).not.toHaveBeenCalled();
      expect(setConfigMock).toHaveBeenCalledWith("mode", "time", {
        nosave: true,
      });
      expect(setConfigMock).toHaveBeenCalledWith("time", 15, {
        nosave: true,
      });
      expect(setConfigMock).toHaveBeenCalledWith("funbox", [], {
        nosave: true,
      });
      expect(restartTestMock).toHaveBeenCalled();
    });
  });

  describe("loadChallengeFromUrl", () => {
    const findGetParameterMock = vi.spyOn(Misc, "findGetParameter");
    const notifyErrorMock = vi.spyOn(Notifications, "showErrorNotification");

    beforeEach(() => {
      findGetParameterMock.mockClear();
      notifyErrorMock.mockClear();
      findGetParameterMock.mockImplementation((name, search) => {
        if (name !== "challenge") return null;
        return search ?? null;
      });
    });

    it("rejects Object.prototype property names as invalid challenges", () => {
      applyUrlSettings("constructor");
      expect(notifyErrorMock).toHaveBeenCalledWith(
        "Failed to load challenge: invalid name constructor",
      );
    });
  });

  describe("loadCustomThemeFromUrl", () => {
    const findGetParameterMock = vi.spyOn(Misc, "findGetParameter");
    const setConfigMock = vi.spyOn(UpdateConfig, "setConfig");
    const notifyMock = vi.spyOn(Notifications, "showNoticeNotification");
    const colors = [
      "#111111",
      "#222222",
      "#333333",
      "#444444",
      "#555555",
      "#666666",
      "#777777",
      "#888888",
      "#999999",
      "#aaaaaa",
    ];

    beforeEach(() => {
      UpdateConfig.setConfig("customTheme", false, { nosave: true });
      [findGetParameterMock, setConfigMock, notifyMock].forEach((m) =>
        m.mockClear(),
      );
      findGetParameterMock.mockImplementation((name, search) => {
        if (name !== "customTheme") return null;
        return search ?? null;
      });
    });

    it("applies shared custom theme and https background with nosave", () => {
      const encoded = btoa(
        JSON.stringify({
          c: colors,
          i: "https://example.com/bg.png",
          s: "cover",
          f: [0, 1, 1, 1],
        }),
      );
      applyUrlSettings(encoded);
      expect(setConfigMock).toHaveBeenCalledWith("customThemeColors", colors, {
        nosave: true,
      });
      expect(setConfigMock).toHaveBeenCalledWith(
        "customBackground",
        "https://example.com/bg.png",
        { nosave: true },
      );
      expect(setConfigMock).toHaveBeenCalledWith(
        "customBackgroundSize",
        "cover",
        { nosave: true },
      );
      expect(setConfigMock).toHaveBeenCalledWith(
        "customBackgroundFilter",
        [0, 1, 1, 1],
        { nosave: true },
      );
      expect(setConfigMock).toHaveBeenCalledWith("customTheme", true, {
        nosave: true,
      });
    });

    it("rejects non-https background URLs and accepts legacy 10-color arrays", () => {
      const insecure = btoa(
        JSON.stringify({
          c: colors,
          i: "http://attacker.example/bg.png",
          s: "cover",
          f: [0, 1, 1, 1],
        }),
      );
      applyUrlSettings(insecure);
      expect(setConfigMock).not.toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalled();

      setConfigMock.mockClear();
      notifyMock.mockClear();
      applyUrlSettings(btoa(JSON.stringify(colors)));
      expect(setConfigMock).toHaveBeenCalledWith("customThemeColors", colors, {
        nosave: true,
      });
      expect(setConfigMock).toHaveBeenCalledWith("customTheme", true, {
        nosave: true,
      });
    });
  });
});

const urlData = (
  data: Partial<{
    mode: Mode | undefined;
    mode2: Mode2<any> | number;
    customText: CustomTextSettings;
    punctuation: boolean;
    numbers: boolean;
    language: string;
    difficulty: Difficulty;
    funbox: string[] | string;
  }>,
): string => {
  return compressToURI(
    JSON.stringify([
      data.mode ?? null,
      data.mode2 ?? null,
      data.customText ?? null,
      data.punctuation ?? null,
      data.numbers ?? null,
      data.language ?? null,
      data.difficulty ?? null,
      data.funbox ?? null,
    ]),
  );
};

// Browser module exports are sealed; register spies before imports run.
vi.mock("../../src/ts/config/setters", { spy: true });
vi.mock("../../src/ts/states/notifications", { spy: true });
vi.mock("../../src/features/typing/state/quote-selection", { spy: true });
vi.mock("../../src/ts/utils/misc", { spy: true });
