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
import * as SoundController from "../controllers/sound-controller";
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
  freedomMode: {
    subgroup: {
      options: "fromSchema",
    },
  },
  strictSpace: {
    subgroup: {
      options: "fromSchema",
    },
  },
  oppositeShiftMode: {
    subgroup: {
      options: "fromSchema",
    },
  },
  stopOnError: {
    subgroup: {
      options: "fromSchema",
    },
  },
  deleteOnError: {
    subgroup: {
      options: "fromSchema",
      display: (deleteOnError) => deleteOnError.replace(/_/g, " "),
    },
  },
  confidenceMode: {
    subgroup: {
      options: "fromSchema",
    },
  },
  quickEnd: {
    subgroup: {
      options: "fromSchema",
    },
  },
  indicateTypos: {
    subgroup: {
      options: "fromSchema",
    },
  },
  compositionDisplay: {
    subgroup: {
      options: "fromSchema",
    },
  },
  hideExtraLetters: {
    subgroup: {
      options: "fromSchema",
    },
  },
  lazyMode: {
    subgroup: {
      options: "fromSchema",
      afterExec: () => void TestLogic.restart(),
    },
  },
  layout: {
    subgroup: {
      options: "fromSchema",
      display: (layout) =>
        layout === "default" ? "off" : layout.replace(/_/g, " "),
      afterExec: () => void TestLogic.restart(),
    },
  },
  codeUnindentOnBackspace: {
    subgroup: {
      options: "fromSchema",
    },
  },
  //sound
  soundVolume: {
    subgroup: {
      options: [0.1, 0.5, 1],
      display: (val) =>
        new Map([
          [0.1, "quiet"],
          [0.5, "medium"],
          [1.0, "loud"],
        ]).get(val) ?? "custom...",
      afterExec: () => SoundController.playClick,
    },
    input: {
      inputValueConvert: Number,
    },
  },
  playSoundOnClick: {
    alias: "play",
    display: "Sound on click...",
    subgroup: {
      options: "fromSchema",
      display: (value) => {
        const map: Record<ConfigSchemas.Config["playSoundOnClick"], string> = {
          off: "off",
          "1": "click",
          "2": "beep",
          "3": "pop",
          "4": "nk creams",
          "5": "typewriter",
          "6": "osu",
          "7": "hitmarker",
          "8": "sine",
          "9": "sawtooth",
          "10": "square",
          "11": "triangle",
          "12": "pentatonic",
          "13": "wholetone",
          "14": "fist fight",
          "15": "rubber keys",
          "16": "fart",
          "17": "akko lavenders",
          "18": "cherrymx black abs",
          "19": "cherrymx black pbt",
          "20": "cherrymx blue abs",
          "21": "cherrymx blue pbt",
          "22": "cherrymx brown pbt",
          "23": "kalih box white",
          "24": "razer green",
          "25": "tealios v2",
          "26": "trust gxt",
        };
        return map[value];
      },
      hover: (value) => {
        if (value === "off") {
          return;
        }
        void SoundController.previewClick(value);
      },
      afterExec: () => {
        void SoundController.playClick();
      },
    },
  },
  playSoundOnError: {
    alias: "play",
    display: "Sound on error...",
    subgroup: {
      options: "fromSchema",
      display: (value) => {
        const map: Record<ConfigSchemas.Config["playSoundOnError"], string> = {
          off: "off",
          "1": "damage",
          "2": "triangle",
          "3": "square",
          "4": "punch miss",
        };
        return map[value];
      },
      hover: (value) => {
        if (value === "off") {
          return;
        }
        void SoundController.previewError(value);
      },
      afterExec: () => {
        void SoundController.playError();
      },
    },
  },
  playTimeWarning: {
    alias: "sound",
    subgroup: {
      options: "fromSchema",
      display: (value) => {
        if (value === "off") {
          return "off";
        }
        return `${value} second${value !== "1" ? "s" : ""}`;
      },
      afterExec: (value) => {
        if (value !== "off") {
          void SoundController.playTimeWarning();
        }
      },
      hover: (value) => {
        if (value !== "off") {
          void SoundController.playTimeWarning();
        }
      },
    },
  },
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
