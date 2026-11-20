import { CommandlineConfigMetadataObject } from "./types";
import { isTypingRouteActive, restartTest } from "../../typing-host";
import * as ConfigSchemas from "@caret/schemas/configs";
import { peekConfig } from "../../config/store";
import { get as getTypingSpeedUnit } from "../../utils/typing-speed-units";

export const behaviorMetadata = {
  difficulty: {
    subgroup: {
      options: "fromSchema",
    },
  },
  quickRestart: {
    subgroup: {
      options: "fromSchema",
    },
  },
  repeatQuotes: {
    subgroup: {
      options: "fromSchema",
    },
  },
  resultSaving: {
    subgroup: {
      options: "fromSchema",
      alias: (val) => (val ? "enabled" : "disabled"),
    },
    alias: "results practice incognito",
  },
  blindMode: {
    subgroup: {
      options: "fromSchema",
    },
  },
  alwaysShowWordsHistory: {
    subgroup: {
      options: "fromSchema",
    },
  },
  singleListCommandLine: {
    subgroup: {
      options: "fromSchema",
    },
  },
  minWpm: {
    alias: "wpm",
    subgroup: {
      options: ["off"],
    },
    input: {
      configValue: "custom",

      secondKey: "minWpmCustomSpeed",
      inputValueConvert: (value) => {
        let newVal = Number(value);
        newVal = getTypingSpeedUnit(peekConfig().typingSpeedUnit).toWpm(newVal);
        return newVal;
      },
    },
  },
  minAcc: {
    subgroup: {
      options: ["off"],
    },
    input: {
      configValue: "custom",

      secondKey: "minAccCustom",
      inputValueConvert: (value) => {
        return Number(value);
      },
    },
  },
  // minBurst: null,
  britishEnglish: {
    subgroup: {
      options: "fromSchema",
      afterExec: () => {
        restartTest();
      },
    },
  },
  // funbox: null,
  customLayoutfluid: {
    input: {
      defaultValue: () => {
        return peekConfig().customLayoutfluid.join(" ");
      },
      inputValueConvert: (val) =>
        val.trim().split(" ") as ConfigSchemas.CustomLayoutFluid,
    },
  },
  customPolyglot: {
    input: {
      defaultValue: () => {
        return peekConfig().customPolyglot.join(" ");
      },
      inputValueConvert: (val) =>
        val.trim().split(" ") as ConfigSchemas.CustomPolyglot,
      afterExec: () => {
        if (isTypingRouteActive()) {
          restartTest();
        }
      },
    },
  },
} satisfies Pick<
  CommandlineConfigMetadataObject,
  | "difficulty"
  | "quickRestart"
  | "repeatQuotes"
  | "resultSaving"
  | "blindMode"
  | "alwaysShowWordsHistory"
  | "singleListCommandLine"
  | "minWpm"
  | "minAcc"
  | "britishEnglish"
  | "customLayoutfluid"
  | "customPolyglot"
>;
