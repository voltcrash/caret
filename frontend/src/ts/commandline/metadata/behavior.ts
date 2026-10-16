import { CommandlineConfigMetadataObject } from "./types";
import * as ConfigSchemas from "@oxytype/schemas/configs";
import * as TestLogic from "../../../features/typing/runtime/test-logic";
import { getMutableConfig } from "../../config/store";
import { get as getTypingSpeedUnit } from "../../utils/typing-speed-units";
import { isTypingRouteActive } from "../../../features/typing/scope";

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
        newVal = getTypingSpeedUnit(getMutableConfig().typingSpeedUnit).toWpm(
          newVal,
        );
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
        void TestLogic.restart();
      },
    },
  },
  // funbox: null,
  customLayoutfluid: {
    input: {
      defaultValue: () => {
        return getMutableConfig().customLayoutfluid.join(" ");
      },
      inputValueConvert: (val) =>
        val.trim().split(" ") as ConfigSchemas.CustomLayoutFluid,
    },
  },
  customPolyglot: {
    input: {
      defaultValue: () => {
        return getMutableConfig().customPolyglot.join(" ");
      },
      inputValueConvert: (val) =>
        val.trim().split(" ") as ConfigSchemas.CustomPolyglot,
      afterExec: () => {
        if (isTypingRouteActive()) {
          void TestLogic.restart();
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
