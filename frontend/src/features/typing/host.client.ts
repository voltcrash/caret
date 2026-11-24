import { bindTypingHost } from "../../ts/typing-host";
import { updateHintsPositionDebounced } from "./components/words/hints";
import { isInputElementFocused } from "./input/input-element";
import * as Focus from "./runtime/focus";
import * as PaceCaret from "./runtime/pace-caret";
import { isNoQuitActive } from "./runtime/session.client";
import * as TestLogic from "./runtime/test/logic";
import { isTypingRouteActive } from "./scope";
import { getTypingLifecycle } from "./state/test-lifecycle/controller";

/** Publishes the typing actions shared code may trigger; returns the release. */
export function bindTypingRouteHost(): () => void {
  // Publish lifecycle selectors before children render; never lazily in JSX.
  getTypingLifecycle();
  return bindTypingHost({
    isRouteActive: isTypingRouteActive,
    restart: (options) => void TestLogic.restart(options),
    blur: () => Focus.set(false),
    reloadPaceCaret: async () => PaceCaret.init(),
    updateHints: () => void updateHintsPositionDebounced(),
    isNoQuitActive,
    isInputFocused: isInputElementFocused,
  });
}
