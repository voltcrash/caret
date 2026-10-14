import { CommandlineConfigMetadataObject } from "./types";

import * as SoundController from "../../controllers/sound-controller";

export const soundMetadata = {
  soundVolume: {
    subgroup: {
      options: [0.1, 0.5, 1],

      afterExec: () => SoundController.playClick,
    },
    input: {
      inputValueConvert: Number,
    },
  },
  playSoundOnClick: {
    alias: "play",

    subgroup: {
      options: "fromSchema",

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

    subgroup: {
      options: "fromSchema",

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
