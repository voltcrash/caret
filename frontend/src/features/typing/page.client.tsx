import {
  createSignal,
  onCleanup,
  onMount,
  Show,
  type JSXElement,
} from "solid-js";
import { Portal } from "solid-js/web";

import { FunboxEffects } from "../../ts/components/core/FunboxEffects";
import { getConfig } from "../../ts/config/store";
import { isTestRestarting, getTestInitError } from "../../ts/states/test";
import { isCoarsePointer } from "../../ts/utils/pointer";
import { BarTimerProgress } from "./components/live-stats/BarTimerProgress";
import { MonkeyPower } from "./components/MonkeyPower";
import { TestPage } from "./components/TestPage";
import { enterTypingRoute, exitTypingRoute } from "./lifecycle";
import { TypingRuntime } from "./runtime.client";
import { focusWords } from "./runtime/test-ui";
import { mountTypingScope } from "./scope";
import { useUrlSettings } from "./url-settings.client";

export default function TypingPage(): JSXElement {
  const release = mountTypingScope();
  let disposed = false;
  onCleanup(() => {
    disposed = true;
    exitTypingRoute();
    release();
  });
  // URL settings restart or navigate; startup restarts must finish first.
  const [entered, setEntered] = createSignal(false);
  useUrlSettings(() => entered() && !isTestRestarting());
  onMount(() => {
    void enterTypingRoute()
      .then(() => {
        if (disposed) return;
        setEntered(true);
        if (!isCoarsePointer() && getTestInitError() === null) focusWords();
      })
      .catch((error: unknown) =>
        console.error("Typing initialization failed", error),
      );
  });
  return (
    <>
      <TypingRuntime />
      {/* Document-level typing chrome lives and dies with the route. */}
      <Portal>
        <FunboxEffects />
        <BarTimerProgress />
        <Show when={getConfig.monkeyPowerLevel !== "off"}>
          <MonkeyPower />
        </Show>
      </Portal>
      <TestPage class="active" />
    </>
  );
}
