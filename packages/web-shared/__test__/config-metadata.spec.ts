import { ConfigSchema } from "@caret/schemas/configs";
import { describe, expect, it } from "vite-plus/test";

import { getDefaultConfig } from "../src/config/default-config";
import {
  getOptionLabel,
  getOptionSearchKeywords,
  getVisibleOptions,
  sharedConfigMetadata,
} from "../src/config/metadata";

describe("sharedConfigMetadata", () => {
  it("describes every config key", () => {
    expect(Object.keys(sharedConfigMetadata).sort()).toEqual(
      Object.keys(ConfigSchema.shape).sort(),
    );
    for (const [key, metadata] of Object.entries(sharedConfigMetadata)) {
      expect(metadata.key).toBe(key);
    }
  });

  it("blocks show all lines in tape mode", () => {
    const currentConfig = { ...getDefaultConfig(), tapeMode: "word" as const };
    expect(
      sharedConfigMetadata.showAllLines.blockedReason?.({
        value: true,
        currentConfig,
      }),
    ).toBe("Show all lines doesn't support tape mode.");
    expect(
      sharedConfigMetadata.showAllLines.blockedReason?.({
        value: false,
        currentConfig,
      }),
    ).toBeUndefined();
  });

  it("resets single-colour custom themes", () => {
    const value = Array(10).fill("#000000") as never;
    expect(
      sharedConfigMetadata.customThemeColors.overrideValue?.({
        value,
        currentValue: value,
        currentConfig: getDefaultConfig(),
      }),
    ).toEqual(getDefaultConfig().customThemeColors);
  });
});

describe("options", () => {
  it("hides legacy caret options", () => {
    expect(getVisibleOptions("caretStyle")).toEqual([
      "off",
      "default",
      "block",
      "outline",
      "underline",
    ]);
  });

  it("labels options like the settings page", () => {
    expect(getOptionLabel("blindMode", false)).toBe("off");
    expect(getOptionLabel("paceCaret", "tagPb")).toBe("tag pb");
    expect(getOptionLabel("showKeyTips", true)).toBe("show");
    expect(getOptionLabel("timerStyle", "flash_mini")).toBe("flash mini");
    expect(getOptionSearchKeywords("difficulty")).toBe("normal expert master");
  });
});
