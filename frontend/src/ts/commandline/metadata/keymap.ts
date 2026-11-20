import { CommandlineConfigMetadataObject } from "./types";
import { restartTest } from "../typing-host";

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

      afterExec: () => restartTest(),
    },
  },
  keymapKeys: {
    subgroup: {
      options: "fromSchema",
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
