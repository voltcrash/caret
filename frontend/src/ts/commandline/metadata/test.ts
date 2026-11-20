import { CommandlineConfigMetadataObject } from "./types";
import { restartTest } from "../../typing-host";

import { isAuthenticated } from "../../states/core";

export const testMetadata = {
  punctuation: {
    subgroup: {
      options: "fromSchema",
      afterExec: () => {
        restartTest();
      },
    },
  },
  numbers: {
    subgroup: {
      options: "fromSchema",
      afterExec: () => {
        restartTest();
      },
    },
  },
  words: {
    alias: "words",
    subgroup: {
      options: [10, 25, 50, 100],
      afterExec: () => {
        restartTest();
      },
    },
    input: {
      inputValueConvert: Number,

      afterExec: () => {
        restartTest();
      },
    },
  },
  time: {
    subgroup: {
      options: [15, 30, 60, 120],
      afterExec: () => {
        restartTest();
      },
    },
    input: {
      inputValueConvert: Number,
      afterExec: () => {
        restartTest();
      },
    },
  },
  mode: {
    subgroup: {
      options: "fromSchema",
      afterExec: () => {
        restartTest();
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
        restartTest();
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
