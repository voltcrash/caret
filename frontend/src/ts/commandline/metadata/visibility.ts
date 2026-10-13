import { CommandlineConfigMetadataObject } from "./types";
import * as ConfigSchemas from "@oxytype/schemas/configs";

export const visibilityMetadata = {
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
} satisfies Pick<
  CommandlineConfigMetadataObject,
  | "showKeyTips"
  | "showOutOfFocusWarning"
  | "showTestModesNotice"
  | "capsLockWarning"
  | "showAverage"
  | "showPb"
  | "monkeyPowerLevel"
>;
