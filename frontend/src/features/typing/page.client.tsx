import { onCleanup, onMount, Show, type JSXElement } from "solid-js";
import { Portal } from "solid-js/web";

import { FunboxEffects } from "../../ts/components/core/FunboxEffects";
import { getConfig } from "../../ts/config/store";
import { BarTimerProgress } from "./components/live-stats/BarTimerProgress";
import { MonkeyPower } from "./components/MonkeyPower";
import { TestPage } from "./components/TestPage";
import { enterTypingRoute, exitTypingRoute } from "./lifecycle";
import { TypingRuntime } from "./runtime.client";
import { mountTypingScope } from "./scope";

export default function TypingPage(): JSXElement {
  const release = mountTypingScope();
  onCleanup(() => {
    exitTypingRoute();
    release();
  });
  onMount(() => {
    void enterTypingRoute().catch((error: unknown) =>
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
