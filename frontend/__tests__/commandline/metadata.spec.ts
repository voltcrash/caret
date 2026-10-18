import { describe, expect, it, vi } from "vite-plus/test";
import { typedKeys } from "@oxytype/util/objects";

vi.mock("../../src/features/typing/runtime/test-logic", () => ({
  restart: vi.fn(),
}));
vi.mock("../../src/ts/ui", () => ({ previewFontFamily: vi.fn() }));
vi.mock("../../src/ts/config/setters", () => ({ setConfig: vi.fn() }));

import { commandlineConfigMetadata } from "../../src/ts/commandline/commandline-metadata";
import { buildCommandForConfigKey } from "../../src/ts/commandline/util";
import { setConfig } from "../../src/ts/config/setters";
import type { CommandWithValidation } from "../../src/ts/commandline/types";

describe("commandline metadata", () => {
  it("preserves every command title and option label", () => {
    expect(
      Object.fromEntries(
        typedKeys(commandlineConfigMetadata).map((key) => {
          const command = buildCommandForConfigKey(key);
          return [
            key,
            {
              title: command.display,
              options: command.subgroup?.list.map((item) => ({
                label: item.display,
                value: item.configValue,
              })),
            },
          ];
        }),
      ),
    ).toMatchSnapshot();
  });
  it.each(typedKeys(commandlineConfigMetadata))(
    "builds a usable %s command",
    (key) => {
      const command = buildCommandForConfigKey(key);
      expect(command.id).not.toBe("");
      expect(command.display).not.toBe("");
      expect(command.input === true || command.subgroup !== undefined).toBe(
        true,
      );
    },
  );

  it("preserves test presets, conversion, and custom input ordering", () => {
    const command = buildCommandForConfigKey("words");
    expect(command.subgroup?.list.map((item) => item.display)).toEqual([
      "10",
      "25",
      "50",
      "100",
      "custom...",
    ]);
    const preset = command.subgroup?.list[0];
    preset?.exec?.({});
    expect(setConfig).toHaveBeenCalledWith("words", 10);
    const input = command.subgroup?.list.at(
      -1,
    ) as CommandWithValidation<number>;
    expect(input.inputValueConvert("42")).toBe(42);
  });

  it("preserves quote option labels and matching behavior", () => {
    const command = buildCommandForConfigKey("quoteLength");
    expect(command.subgroup?.list.map((item) => item.display)).toEqual([
      "all",
      "short",
      "medium",
      "long",
      "thicc",
      "favorite",
    ]);
    expect(command.subgroup?.list.map((item) => item.configValueMode)).toEqual(
      Array(6).fill("include"),
    );
    expect(command.subgroup?.list.at(-1)?.available?.()).toBe(false);
  });

  it("keeps off options first and keeps labels for caret styles", () => {
    expect(
      buildCommandForConfigKey("smoothCaret").subgroup?.list[0]?.configValue,
    ).toBe("off");
    expect(
      buildCommandForConfigKey("caretStyle").subgroup?.list.map(
        (item) => item.display,
      ),
    ).toContain("block");
  });
});
