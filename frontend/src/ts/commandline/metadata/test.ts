import { CommandlineConfigMetadataObject } from "./types";
import * as TestLogic from "../../../features/typing/runtime/test-logic";

import { isAuthenticated } from "../../states/core";

export const testMetadata = {
  punctuation: {
    subgroup: {
      options: "fromSchema",
      afterExec: () => {
        void TestLogic.restart();
      },
    },
  },
  numbers: {
    subgroup: {
      options: "fromSchema",
      afterExec: () => {
        void TestLogic.restart();
      },
    },
  },
  words: {
    alias: "words",
    subgroup: {
      options: [10, 25, 50, 100],
      afterExec: () => {
        void TestLogic.restart();
      },
    },
    input: {
      inputValueConvert: Number,

      afterExec: () => {
        void TestLogic.restart();
      },
    },
  },
  time: {
    subgroup: {
      options: [15, 30, 60, 120],
      afterExec: () => {
        void TestLogic.restart();
      },
    },
    input: {
      inputValueConvert: Number,
      afterExec: () => {
        void TestLogic.restart();
      },
    },
  },
  mode: {
    subgroup: {
      options: "fromSchema",
      afterExec: () => {
        void TestLogic.restart();
      },
    },
  },
  quoteLength: {
    alias: "quotes",
    subgroup: {
      options: [[0, 1, 2, 3], [0], [1], [2], [3], [-3]],
      configValueMode: () => "include",
      isAvailable: (value) => {
        if (value[0] === -3) {
          return isAuthenticated;
        }
        return undefined;
      },

      afterExec: () => {
        void TestLogic.restart();
      },
    },
  },
  language: {
    subgroup: {
      options: "fromSchema",
    },
  },
} satisfies Pick<
  CommandlineConfigMetadataObject,
  | "punctuation"
  | "numbers"
  | "words"
  | "time"
  | "mode"
  | "quoteLength"
  | "language"
>;
