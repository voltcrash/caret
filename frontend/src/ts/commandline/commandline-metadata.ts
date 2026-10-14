import { visibilityMetadata } from "./metadata/visibility";
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
  ...visibilityMetadata,
};
