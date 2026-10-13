import { themesMetadata } from "./metadata/themes";
import { keymapMetadata } from "./metadata/keymap";
import { appearanceMetadata } from "./metadata/appearance";
import { caretMetadata } from "./metadata/caret";
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
  ...caretMetadata,

  //appearence
  ...appearanceMetadata,
  ...keymapMetadata,

  //themes
  ...themesMetadata,

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
