import { CommandlineConfigMetadataObject } from "./types";
import * as TestLogic from "../../../features/typing/runtime/test-logic";
import { getMutableConfig } from "../../config/store";
import { get as getTypingSpeedUnit } from "../../utils/typing-speed-units";

export const caretMetadata = {
  smoothCaret: {
    subgroup: {
      options: "fromSchema",
    },
  },
  caretStyle: {
    subgroup: {
      options: "fromSchema",
      isVisible: (value) => !["banana", "carrot", "monkey"].includes(value),
    },
  },
  paceCaret: {
    subgroup: {
      options: ["off", "pb", "tagPb", "last", "average", "daily"],
      afterExec: () => {
        void TestLogic.restart();
      },
    },
    input: {
      secondKey: "paceCaretCustomSpeed",
      configValue: "custom",
      inputValueConvert: (value) => {
        let newVal = Number(value);
        newVal = getTypingSpeedUnit(getMutableConfig().typingSpeedUnit).toWpm(
          newVal,
        );
        return newVal;
      },
      afterExec: () => {
        void TestLogic.restart();
      },
    },
  },
  repeatedPace: {
    subgroup: {
      options: "fromSchema",
    },
  },
  paceCaretStyle: {
    subgroup: {
      options: "fromSchema",
      isVisible: (value) => !["banana", "carrot", "monkey"].includes(value),
    },
  },
} satisfies Pick<
  CommandlineConfigMetadataObject,
  "smoothCaret" | "caretStyle" | "paceCaret" | "repeatedPace" | "paceCaretStyle"
>;
