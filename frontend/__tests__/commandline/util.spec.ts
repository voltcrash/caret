//import type { ConfigMetadata } from "../../src/ts/config/metadata";

import { describe, it, expect, afterAll, vi } from "vite-plus/test";
import * as Util from "../../src/ts/commandline/util";

import type { CommandlineConfigMetadata } from "../../src/ts/commandline/commandline-metadata";
import type { ConfigKey } from "@oxytype/schemas/configs";
import type { ConfigMetadata } from "../../src/ts/config/metadata";
import { z, ZodSchema } from "zod/v3";
import { Command } from "../../src/ts/commandline/types";
import { setConfig } from "../../src/ts/config/setters";

vi.mock("../../src/ts/config/setters", () => ({ setConfig: vi.fn() }));

const buildCommandForConfigKey = Util.__testing._buildCommandForConfigKey;

vi.mock("../../src/ts/config/metadata", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  configMetadata: [],
}));
vi.mock("../../src/ts/commandline/commandline-metadata", () => ({
  commandlineConfigMetadata: [],
}));

describe("CommandlineUtils", () => {
  afterAll(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });
  describe("buildCommandWithSubgroup", () => {
    it("uses config metadata for titles and option labels", () => {
      const command = buildCommand({
        key: "showKeyTips",
        cmdMeta: { subgroup: { options: "fromSchema" } },
        configMeta: {
          commandline: { title: "Key tips..." },
          optionsMetadata: {
            true: { displayString: "show", commandlineLabel: "on" },
            false: { displayString: "hide" },
          },
        },
        schema: z.boolean(),
      });
      expect(command.display).toBe("Key tips...");
      expect(command.subgroup?.list.map((item) => item.display)).toEqual([
        "hide",
        "on",
      ]);
    });
    describe("type subgroup", () => {
      it("detects options for boolean schema", () => {
        //GIVEN
        const schema = z.boolean();

        //WHEN
        const cmd = buildCommand({
          cmdMeta: { subgroup: { options: "fromSchema" } },
          schema,
        });

        //THEN
        expect(cmd.subgroup?.list.map((it) => it.id)).toEqual([
          "setFalse",
          "setTrue",
        ]);
      });

      it("detects options for enum schema", () => {
        //GIVEN
        const schema = z.enum(["one", "two", "three"]);

        //WHEN
        const cmd = buildCommand({
          cmdMeta: { subgroup: { options: "fromSchema" } },
          schema,
        });

        //THEN
        expect(cmd.subgroup?.list.map((it) => it.id)).toEqual([
          "setOne",
          "setTwo",
          "setThree",
        ]);
      });

      it("detects options for union schema of enum + literral", () => {
        //GIVEN
        const schema = z.literal("default").or(z.enum(["one", "two", "three"]));

        //WHEN
        const cmd = buildCommand({
          cmdMeta: { subgroup: { options: "fromSchema" } },
          schema,
        });

        //THEN
        expect(cmd.subgroup?.list.map((it) => it.id)).toEqual([
          "setDefault",
          "setOne",
          "setTwo",
          "setThree",
        ]);
      });

      it("uses preset options over schema values", () => {
        //GIVEN
        const schema = z.enum(["one", "two", "three"]);

        //WHEN
        const cmd = buildCommand({
          cmdMeta: { subgroup: { options: ["one", "two"] } },
          schema,
        });

        //THEN
        expect(cmd.subgroup?.list.map((it) => it.id)).toEqual([
          "setOne",
          "setTwo",
        ]);
      });

      it("uses preset option  for number schema", () => {
        //GIVEN
        const schema = z.number().int();

        //WHEN
        const cmd = buildCommand({
          cmdMeta: { subgroup: { options: [0.25, 0.75] } },
          schema,
        });

        //THEN
        expect(cmd.subgroup?.list.map((it) => it.id)).toEqual([
          "set0.25",
          "set0.75",
        ]);
      });

      it("sets available", () => {
        //GIVEN
        const schema = z.boolean();
        const isAvailable = (val: any): (() => true) | undefined =>
          // oxlint-disable-next-line typescript/strict-boolean-expressions -- Exercise truthiness of unvalidated mock values.
          val ? () => true : undefined;

        //WHEN
        const cmd = buildCommand({
          cmdMeta: {
            subgroup: {
              options: "fromSchema",
              isAvailable,
            },
          },
          schema,
        });

        //THEN
        expect(cmd.subgroup?.list[0]?.available).toBeUndefined();
        expect(cmd.subgroup?.list[1]?.available?.()).toBe(true);
      });
    });

    describe("type subgroupWithInput", () => {
      it("uses commandValues for number schema", () => {
        //GIVEN
        const afterExec = (): string => "test";
        const schema = z.number().int();

        //WHEN
        const cmd = buildCommand({
          key: "test" as any,
          cmdMeta: {
            subgroup: {
              options: [0.25, 0.75],
            },
            input: {
              inputValueConvert: Number,
              afterExec,
              alias: "alias",
            },
          },
          configMeta: {
            commandline: { inputTitle: "custom test..." },
            fa: {
              icon: "fa-keyboard",
            },
          },
          schema,
        });

        const inputCmd = cmd.subgroup?.list[cmd.subgroup?.list.length - 1];

        //THEN
        expect(cmd.subgroup?.list.map((it) => it.id)).toEqual([
          "setTest0.25",
          "setTest0.75",
          "setTestCustom",
        ]);

        expect(inputCmd).toEqual({
          id: "setTestCustom",
          display: "custom test...",
          defaultValue: expect.anything(),
          alias: "alias",
          input: true,
          icon: "fa-keyboard",
          exec: expect.anything(),
          hover: undefined,
          configValue: undefined,
          inputValueConvert: Number,
          validation: expect.anything(),
        });
      });
    });
  });

  describe("type input", () => {
    it("executes converted input and preserves callbacks without submitting missing input", () => {
      const afterExec = vi.fn();
      const command = buildCommand({
        key: "fontSize",
        cmdMeta: { input: { inputValueConvert: Number, afterExec } },
        schema: z.number(),
      });
      command.exec?.({ input: 1.5 as any });
      expect(setConfig).toHaveBeenLastCalledWith("fontSize", 1.5);
      expect(afterExec).toHaveBeenCalledExactlyOnceWith(1.5);
      command.exec?.({});
      expect(afterExec).toHaveBeenCalledOnce();
    });
    it("has basic properties", () => {
      //GIVEN
      const afterExec = (): string => "test";
      const schema = z.string();
      //WHEN
      const cmd = buildCommand({
        key: "test" as any,
        cmdMeta: {
          input: {
            afterExec,
            alias: "alias",
          },
        },
        configMeta: {
          commandline: { inputTitle: "custom test..." },
          fa: {
            icon: "fa-keyboard",
          },
        },
        schema,
      });

      //THEN
      expect(cmd).toEqual(
        expect.objectContaining({
          id: "setTestCustom",
          display: "custom test...",
          alias: "alias",
          input: true,
          icon: "fa-keyboard",
        }),
      );
    });

    it("uses displayString from config for display ", () => {
      //GIVEN

      //WHEN
      const cmd = buildCommand({
        cmdMeta: { input: {} },
        configMeta: { displayString: "My Setting" },
      });

      //THEN
      expect(cmd.display).toEqual("My Setting...");
    });

    it("uses input title from config metadata if provided", () => {
      //GIVEN

      //WHEN
      const cmd = buildCommand({
        cmdMeta: {
          input: {},
        },
        configMeta: {
          commandline: { inputTitle: "Input setting..." },
          displayString: "My Setting",
        },
      });

      //THEN
      expect(cmd.display).toEqual("Input setting...");
    });

    it("display is custom... if part of subgroup (without display override)", () => {
      //GIVEN

      //WHEN
      const cmd = buildCommand({
        cmdMeta: {
          input: {},
          subgroup: {
            options: [],
          },
        },
        configMeta: { displayString: "My Setting" },
      });

      //THEN
      expect(cmd.subgroup?.list[0]?.display).toEqual("custom...");
    });

    it("display is is using display override if part of subgroup", () => {
      //GIVEN

      //WHEN
      const cmd = buildCommand({
        cmdMeta: {
          input: {},
          subgroup: {
            options: [],
          },
        },
        configMeta: {
          commandline: { inputTitle: "Input setting..." },
          displayString: "My Setting",
        },
      });

      //THEN
      expect(cmd.subgroup?.list[0]?.display).toEqual("Input setting...");
    });

    it("uses inputValueConvert", () => {
      //GIVEN
      const schema = z.number().int();

      //WHEN
      const cmd = buildCommand({
        key: "test" as any,
        cmdMeta: { input: { inputValueConvert: Number } },
        schema,
      });

      //THEN
      expect(cmd).toEqual(
        expect.objectContaining({
          inputValueConvert: Number,
        }),
      );
    });

    it("uses validation from schema", () => {
      //GIVEN
      const schema = z.enum(["on", "off"]);

      //WHEN
      const cmd = buildCommand({
        key: "test" as any,
        cmdMeta: { input: { validation: { schema: true } } },
        schema,
      });

      expect(cmd).toEqual(
        expect.objectContaining({
          validation: { schema },
        }),
      );
    });

    it("does not use validation if empty", () => {
      //GIVEN
      const schema = z.enum(["on", "off"]);

      //WHEN
      const cmd = buildCommand({
        key: "test" as any,
        cmdMeta: { input: { validation: {} } },
        schema,
      });

      expect(cmd).toHaveProperty("validation", {});
    });

    it("uses validation by default", () => {
      //GIVEN
      const schema = z.enum(["on", "off"]);

      //WHEN
      const cmd = buildCommand({
        key: "test" as any,
        cmdMeta: { input: {} },
        schema,
      });

      expect(cmd).toEqual(
        expect.objectContaining({
          validation: { schema },
        }),
      );
    });

    it("uses validation with isValid", () => {
      //GIVEN
      const schema = z.enum(["on", "off"]);
      const isValid = async (_val: any): Promise<boolean | string> =>
        Promise.resolve("error");

      //WHEN
      const cmd = buildCommand({
        key: "test" as any,
        cmdMeta: { input: { validation: { isValid: isValid } } },
        schema,
      });

      expect(cmd).toEqual(
        expect.objectContaining({
          validation: { isValid },
        }),
      );
    });

    it("uses secondKey", () => {
      //GIVEN
      const schema = z.enum(["on", "off"]);

      //WHEN
      const cmd = buildCommand({
        key: "test" as any,
        cmdMeta: {
          input: { secondKey: "mySecondKey" },
        },
        schema,
      });

      expect(cmd).toEqual(
        expect.objectContaining({
          id: "setMySecondKeyCustom",
          display: "MySecondKey...",
        }),
      );
    });
  });
});

function buildCommand<K extends ConfigKey>({
  cmdMeta,
  configMeta,
  schema,
  key,
}: {
  cmdMeta: Partial<CommandlineConfigMetadata<any, any>>;
  configMeta?: Partial<ConfigMetadata<K>>;
  schema?: ZodSchema;
  key?: K;
}): Command {
  return buildCommandForConfigKey(
    key ?? ("" as any),
    configMeta ?? ({} as any),
    cmdMeta as any,
    schema ?? z.string(),
  );
}
