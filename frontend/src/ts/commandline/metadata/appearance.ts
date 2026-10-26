import { CommandlineConfigMetadataObject } from "./types";

import { Fonts } from "../../constants/fonts";
import { KnownFontName } from "@caret/schemas/fonts";
import * as UI from "../../ui";
import { typedKeys } from "@caret/util/objects";

export const appearanceMetadata = {
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
    },
    alias: "timer",
  },
  timerColor: {
    alias: "timer speed wpm burst acc",
    subgroup: {
      options: "fromSchema",
      alias: () => "timer",
    },
  },
  timerOpacity: {
    alias: "timer speed wpm burst acc",
    subgroup: {
      options: "fromSchema",
      alias: () => "timer",
    },
  },
  highlightMode: {
    subgroup: {
      options: "fromSchema",
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
} satisfies Pick<
  CommandlineConfigMetadataObject,
  | "liveSpeedStyle"
  | "liveAccStyle"
  | "liveBurstStyle"
  | "timerStyle"
  | "timerColor"
  | "timerOpacity"
  | "highlightMode"
  | "typedEffect"
  | "tapeMode"
  | "tapeMargin"
  | "smoothLineScroll"
  | "showAllLines"
  | "typingSpeedUnit"
  | "alwaysShowDecimalPlaces"
  | "startGraphsAtZero"
  | "maxLineWidth"
  | "fontSize"
  | "fontFamily"
>;
