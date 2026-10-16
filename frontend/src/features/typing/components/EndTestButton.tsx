import { createSignal, JSXElement, onCleanup, Show } from "solid-js";

import { Button } from "../../../ts/components/common/Button";
import { getConfig } from "../../../ts/config/store";
import { createEffectOn } from "../../../ts/hooks/effects";
import { getCustomTextIndicator } from "../../../ts/states/core";
import { isTestActive, setBailedOut } from "../../../ts/states/test";
import { canQuickRestart } from "../../../ts/utils/quick-restart";
import * as CustomText from "../runtime/custom-text";
import * as TestLogic from "../runtime/test-logic";

const CONFIRM_MS = 3000;

// Touch-only equivalent of double tapping shift+enter to bail out of an
// endless or very long test. zen and long custom texts have their own buttons.
export function EndTestButton(): JSXElement {
  const [confirming, setConfirming] = createSignal(false);
  let confirmTimeout: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(confirmTimeout));

  const canBailOut = (): boolean =>
    isTestActive() &&
    getConfig.mode !== "zen" &&
    getCustomTextIndicator()?.isLong !== true &&
    !canQuickRestart(
      getConfig.mode,
      getConfig.words,
      getConfig.time,
      CustomText.getData(),
      false,
    );

  createEffectOn(canBailOut, (available) => {
    if (available) return;
    clearTimeout(confirmTimeout);
    setConfirming(false);
  });

  return (
    <Show when={canBailOut()}>
      <Button
        id="endTestButton"
        variant="text"
        class="col-[content] mx-auto mt-4 hidden px-[2em] py-[1em] text-[1rem] pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        text={confirming() ? "tap again to end" : "end test"}
        fa={{ icon: "fa-flag-checkered", fixedWidth: true }}
        onClick={() => {
          // a stray tap must not end an hour long test
          if (!confirming()) {
            setConfirming(true);
            confirmTimeout = setTimeout(() => setConfirming(false), CONFIRM_MS);
            return;
          }
          clearTimeout(confirmTimeout);
          setConfirming(false);
          setBailedOut(true);
          void TestLogic.finish();
        }}
      />
    </Show>
  );
}
