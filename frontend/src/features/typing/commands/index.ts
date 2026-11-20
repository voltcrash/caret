import { onCleanup } from "solid-js";

import { bindCommandlineTypingHost } from "../../../ts/commandline/typing-host";
import * as Focus from "../runtime/focus";
import * as PaceCaret from "../runtime/pace-caret";
import * as TestLogic from "../runtime/test/logic";
import { isTypingRouteActive } from "../scope";

/** Publishes typing commands and actions for the mounted palette. */
export function useTypingCommands(): void {
  onCleanup(
    bindCommandlineTypingHost({
      restart: () => void TestLogic.restart(),
      isRouteActive: isTypingRouteActive,
      blur: () => Focus.set(false),
      reloadPaceCaret: async () => PaceCaret.init(),
    }),
  );
}
