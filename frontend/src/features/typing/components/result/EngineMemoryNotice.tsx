import { createMemo, Show, type JSXElement } from "solid-js";

import { pendingResultSaves } from "#app/update-safety.ts";
import { Button } from "#shared/components/common/Button.tsx";
import { getBrowserEngine } from "#shared/engine/owner.client.ts";
import { getResultVisible, isResultCalculating } from "#shared/states/test.ts";

import { resultOutbox } from "../../history/outbox.client";

/** A new document safely releases Wasm's high-water memory and every handle. */
export function EngineMemoryNotice(): JSXElement {
  const largeSession = createMemo(
    () =>
      getResultVisible() &&
      !isResultCalculating() &&
      getBrowserEngine().status().state === "ready" &&
      getBrowserEngine().api().memoryBytes() > 32 * 1024 * 1024,
  );
  const saving = (): boolean =>
    pendingResultSaves() > 0 || resultOutbox().entries().length > 0;
  return (
    <Show when={largeSession()}>
      <div class="flex flex-wrap items-center justify-center gap-2 text-sub">
        <span>A long session is retaining extra memory.</span>
        <Button
          text="Refresh to free memory"
          disabled={saving()}
          onClick={() => {
            if (!saving()) window.location.reload();
          }}
        />
      </div>
    </Show>
  );
}
