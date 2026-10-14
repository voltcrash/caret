import { CommandlineConfigMetadataObject } from "./types";

export const visibilityMetadata = {
  showKeyTips: {
    subgroup: {
      options: "fromSchema",
    },
  },
  showOutOfFocusWarning: {
    subgroup: {
      options: "fromSchema",
    },
  },
  showTestModesNotice: {
    subgroup: {
      options: "fromSchema",
    },
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
