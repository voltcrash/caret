import { CommandlineConfigMetadataObject } from "./types";
import * as TestLogic from "../../../features/typing/runtime/test-logic";

export const inputMetadata = {
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

      afterExec: () => void TestLogic.restart(),
    },
  },
  codeUnindentOnBackspace: {
    subgroup: {
      options: "fromSchema",
    },
  },
} satisfies Pick<
  CommandlineConfigMetadataObject,
  | "freedomMode"
  | "strictSpace"
  | "oppositeShiftMode"
  | "stopOnError"
  | "deleteOnError"
  | "confidenceMode"
  | "quickEnd"
  | "indicateTypos"
  | "compositionDisplay"
  | "hideExtraLetters"
  | "lazyMode"
  | "layout"
  | "codeUnindentOnBackspace"
>;
