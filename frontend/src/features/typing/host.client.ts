import { bindTypingHost } from "../../ts/typing-host";
import * as Focus from "./runtime/focus";
import * as PaceCaret from "./runtime/pace-caret";
import * as TestLogic from "./runtime/test/logic";
import { isTypingRouteActive } from "./scope";

/** Publishes the typing actions shared code may trigger; returns the release. */
export function bindTypingRouteHost(): () => void {
  return bindTypingHost({
    isRouteActive: isTypingRouteActive,
    restart: () => void TestLogic.restart(),
    blur: () => Focus.set(false),
    reloadPaceCaret: async () => PaceCaret.init(),
  });
}
