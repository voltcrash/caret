import { onMount, Show, type JSXElement } from "solid-js";

import { Button } from "../../../../ts/components/common/Button";
import { showErrorNotification } from "../../../../ts/states/notifications";
import { resultOutbox } from "../../result-outbox.client";
import {
  discardPendingResults,
  retrySavingResult,
} from "../../runtime/result-saving";

export function PendingResults(): JSXElement {
  const queue = resultOutbox();
  const report = (error: unknown): void => {
    showErrorNotification("Could not update pending results", { error });
  };
  onMount(() => {
    void queue.load().catch(report);
  });
  return (
    <Show when={queue.entries().length > 0}>
      <div
        class="flex flex-wrap items-center justify-center gap-2 text-sub"
        role="status"
      >
        <span>
          {queue.entries().length} result(s) pending upload. Keep browser data
          to retain them.
        </span>
        <Button
          text="retry pending"
          onClick={() => {
            void retrySavingResult().catch(report);
          }}
        />
        <Button
          text="discard pending"
          onClick={() => {
            void discardPendingResults().catch(report);
          }}
        />
      </div>
    </Show>
  );
}
