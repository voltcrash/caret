import { soundMetadata } from "./metadata/sound";
import { inputMetadata } from "./metadata/input";
import { behaviorMetadata } from "./metadata/behavior";
import { testMetadata } from "./metadata/test";
import { CommandlineConfigMetadataObject } from "./metadata/types";
export {
  type CommandlineConfigMetadataObject,
  type InputProps,
  type CommandlineConfigMetadata,
  type SubgroupProps,
} from "./metadata/types";
import * as ConfigSchemas from "@oxytype/schemas/configs";

import * as TestLogic from "../test/test-logic";
import { replaceUnderscoresWithSpaces } from "../utils/strings";

import { Config } from "../config/store";
import { get as getTypingSpeedUnit } from "../utils/typing-speed-units";
import { isAuthenticated } from "../states/core";
import { Fonts } from "../constants/fonts";
import { KnownFontName } from "@oxytype/schemas/fonts";
import * as UI from "../ui";

import { typedKeys } from "@oxytype/util/objects";

export const commandlineConfigMetadata: CommandlineConfigMetadataObject = {
  //test
  ...testMetadata,
  //behavior
  ...behaviorMetadata,
  //input
  ...inputMetadata,
  //sound
  ...soundMetadata,
  //caret
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
    display: "Pace caret mode...",
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
        newVal = getTypingSpeedUnit(Config.typingSpeedUnit).toWpm(newVal);
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

  //appearence
  liveSpeedStyle: {
    subgroup: {
      options: "fromSchema",
    },
    alias: "wpm",
  },
  liveAccStyle: {
    subgroup: {
      options: "fromSchema",
    },
    alias: "wpm",
  },
  liveBurstStyle: {
    subgroup: {
      options: "fromSchema",
    },
    alias: "wpm",
  },
  timerStyle: {
    subgroup: {
      options: "fromSchema",
      display: replaceUnderscoresWithSpaces,
    },
    alias: "timer",
  },
  timerColor: {
    display: "Live progress color...",
    alias: "timer speed wpm burst acc",
    subgroup: {
      options: "fromSchema",
      alias: () => "timer",
    },
  },
  timerOpacity: {
    display: "Live progress opacity...",
    alias: "timer speed wpm burst acc",
    subgroup: {
      options: "fromSchema",
      alias: () => "timer",
    },
  },
  highlightMode: {
    subgroup: {
      options: "fromSchema",
      display: replaceUnderscoresWithSpaces,
    },
  },
  typedEffect: {
    subgroup: {
      options: "fromSchema",
    },
  },
  tapeMode: {
    subgroup: {
      options: "fromSchema",
    },
  },
  tapeMargin: {
    input: {
      inputValueConvert: Number,
    },
  },
  smoothLineScroll: {
    subgroup: {
      options: "fromSchema",
    },
  },
  showAllLines: {
    subgroup: {
      options: "fromSchema",
    },
  },
  typingSpeedUnit: {
    subgroup: {
      options: "fromSchema",
      isVisible: (val) => val !== "wph",
    },
  },
  alwaysShowDecimalPlaces: {
    subgroup: {
      options: "fromSchema",
    },
  },
  startGraphsAtZero: {
    subgroup: {
      options: "fromSchema",
    },
  },
  maxLineWidth: {
    input: {
      alias: "page",
      inputValueConvert: Number,
    },
  },
  fontSize: {
    input: {
      inputValueConvert: Number,
    },
  },
  fontFamily: {
    subgroup: {
      options: typedKeys(Fonts).sort((a, b) =>
        (Fonts[a]?.display ?? a.replace(/_/g, " ")).localeCompare(
          Fonts[b]?.display ?? b.replace(/_/g, " "),
        ),
      ),
      display: (name) =>
        Fonts[name as KnownFontName]?.display ?? name.replaceAll(/_/g, " "),
      customData: (name) => {
        const fontConfig = Fonts[name as KnownFontName];
        if (fontConfig === undefined) return {};
        return {
          name: name.replaceAll(/_/g, " "),
          isSystem: fontConfig.systemFont === true,
          display: fontConfig.display,
        } as Record<string, string | boolean>;
      },
      hover: (name) => UI.previewFontFamily(name),
    },
  },
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

  //themes
  customTheme: {
    subgroup: {
      options: "fromSchema",
    },
  },
  flipTestColors: {
    subgroup: {
      options: "fromSchema",
    },
  },
  colorfulMode: {
    subgroup: {
      options: "fromSchema",
    },
  },
  customBackground: {
    input: {},
  },
  customBackgroundSize: {
    subgroup: {
      options: "fromSchema",
    },
  },
  randomTheme: {
    subgroup: {
      options: "fromSchema",
      isAvailable: (value) =>
        value === "custom" ? isAuthenticated : undefined,
    },
  },

  //showhide
  showKeyTips: {
    subgroup: {
      options: "fromSchema",
    },
    display: "Key tips...",
  },
  showOutOfFocusWarning: {
    subgroup: {
      options: "fromSchema",
    },
    display: "Out of focus warning...",
  },
  showTestModesNotice: {
    subgroup: {
      options: "fromSchema",
    },
    display: "Test modes notice...",
  },
  capsLockWarning: {
    subgroup: {
      options: "fromSchema",
    },
  },
  showAverage: {
    subgroup: {
      options: "fromSchema",
    },
  },
  showPb: {
    subgroup: {
      options: "fromSchema",
    },
    alias: "pb",
  },
  monkeyPowerLevel: {
    alias: "powermode",
    isVisible: false,
    subgroup: {
      options: "fromSchema",
      display: (value) => {
        const map: Record<ConfigSchemas.Config["monkeyPowerLevel"], string> = {
          off: "off",
          "1": "mellow",
          "2": "high",
          "3": "ultra",
          "4": "over 9000",
        };
        return map[value];
      },
    },
  },
};
