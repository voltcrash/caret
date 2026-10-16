import { onCleanup, onMount, type JSXElement } from "solid-js";

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
      <TestPage class="active" />
    </>
  );
}
