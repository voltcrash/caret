import { CommandlineConfigMetadataObject } from "./types";
import * as TestLogic from "../../test/test-logic";
import { replaceUnderscoresWithSpaces } from "../../utils/strings";

export const keymapMetadata = {
  keymapMode: {
    alias: "keyboard",
    subgroup: {
      options: "fromSchema",
      alias: (val) => (val === "react" ? "flash" : ""),
    },
  },
  keymapStyle: {
    subgroup: {
      options: "fromSchema",
      display: replaceUnderscoresWithSpaces,
    },
    alias: "keyboard",
  },
  keymapLegendStyle: {
    subgroup: {
      options: "fromSchema",
    },
    alias: "keyboard",
  },
  keymapSize: {
    input: {
      alias: "keyboard",
      inputValueConvert: Number,
    },
  },
  keymapLayout: {
    alias: "keyboard",
    subgroup: {
      options: "fromSchema",
      alias: (val) => (val === "overrideSync" ? "default" : ""),
      display: (layout) =>
        layout === "overrideSync" ? "emulator sync" : layout.replace(/_/g, " "),
      afterExec: () => void TestLogic.restart(),
    },
  },
  keymapKeys: {
    subgroup: {
      options: "fromSchema",
      display: replaceUnderscoresWithSpaces,
    },
    alias: "keyboard",
  },
} satisfies Pick<
  CommandlineConfigMetadataObject,
  | "keymapMode"
  | "keymapStyle"
  | "keymapLegendStyle"
  | "keymapSize"
  | "keymapLayout"
  | "keymapKeys"
>;
