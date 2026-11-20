import {
  createSignal,
  onCleanup,
  onMount,
  Show,
  type JSXElement,
} from "solid-js";
import { Portal } from "solid-js/web";

import { getConfig } from "../../ts/config/store";
import { isTestRestarting, getTestInitError } from "../../ts/states/test";
import { isCoarsePointer } from "../../ts/utils/pointer";
import { FunboxEffects } from "./components/FunboxEffects";
import { BarTimerProgress } from "./components/live-stats/BarTimerProgress";
import { MonkeyPower } from "./components/MonkeyPower";
import { TestPage } from "./components/TestPage";
import { bindTypingRouteHost } from "./host.client";
import { enterTypingRoute, exitTypingRoute } from "./lifecycle/route";
import { TypingRuntime } from "./runtime.client";
import { focusWords } from "./runtime/test/ui";
import { mountTypingScope } from "./scope";
import { useUrlSettings } from "./url-settings.client";

export default function TypingPage(): JSXElement {
  const release = mountTypingScope();
  const releaseHost = bindTypingRouteHost();
  const [phase, setPhase] = createSignal<"entering" | "entered" | "disposed">(
    "entering",
  );
  onCleanup(() => {
    setPhase("disposed");
    exitTypingRoute();
    releaseHost();
    release();
  });
  // URL settings restart or navigate; startup restarts must finish first.
  useUrlSettings(() => phase() === "entered" && !isTestRestarting());
  onMount(() => {
    void enterTypingRoute()
      .then(() => {
        if (phase() !== "entering") return;
        setPhase("entered");
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
