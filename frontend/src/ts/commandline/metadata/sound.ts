import { CommandlineConfigMetadataObject } from "./types";
import * as ConfigSchemas from "@oxytype/schemas/configs";
import * as SoundController from "../../controllers/sound-controller";

export const soundMetadata = {
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
} satisfies Pick<
  CommandlineConfigMetadataObject,
  "soundVolume" | "playSoundOnClick" | "playSoundOnError" | "playTimeWarning"
>;
