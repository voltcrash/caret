import { CommandlineConfigMetadataObject } from "./types";
import { isAuthenticated } from "../../states/core";

export const themesMetadata = {
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
} satisfies Pick<
  CommandlineConfigMetadataObject,
  | "customTheme"
  | "flipTestColors"
  | "colorfulMode"
  | "customBackground"
  | "customBackgroundSize"
  | "randomTheme"
>;
