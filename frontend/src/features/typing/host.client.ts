import { bindTypingHost } from "../../ts/typing-host";
import { updateHintsPositionDebounced } from "./components/words/hints";
import * as Focus from "./runtime/focus";
import * as PaceCaret from "./runtime/pace-caret";
import { isNoQuitActive } from "./runtime/session.client";
import * as TestLogic from "./runtime/test/logic";
import { isTypingRouteActive } from "./scope";

/** Publishes the typing actions shared code may trigger; returns the release. */
export function bindTypingRouteHost(): () => void {
  return bindTypingHost({
    isRouteActive: isTypingRouteActive,
    restart: (options) => void TestLogic.restart(options),
    blur: () => Focus.set(false),
    reloadPaceCaret: async () => PaceCaret.init(),
    updateHints: () => void updateHintsPositionDebounced(),
    isNoQuitActive,
  });
}
