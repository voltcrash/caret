import type { EventLog } from "@oxytype/typing-core/events/types";

import { JSXElement, Show } from "solid-js";

import {
  getError,
  getEventLog,
  getRaw,
  getStage,
  resetEventLogViewer,
  setError,
  setEventLog,
  setRaw,
  setStage,
} from "../../states/event-log-viewer";
import { hideModal } from "../../states/modals";
import { getLastEventLog } from "../../states/test";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { parseContext } from "./event-log-viewer/event-log";
import { PreviewContent } from "./event-log-viewer/PreviewContent";

export function EventLogViewerModal(): JSXElement {
  const stage = getStage;
  const raw = getRaw;
  const ctx = getEventLog;
  const err = getError;

  const loadFrom = (json: string): void => {
    try {
      const parsed = parseContext(json);
      setEventLog(parsed);
      setError(null);
      setStage("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onShow = (): void => loadFrom(raw());

  const onLoadLatest = (): void => {
    const log = getLastEventLog();
    if (log === null) {
      setError("No event log available - complete a test first");
      return;
    }
    const json = JSON.stringify(log);
    setRaw(json);
    loadFrom(json);
  };

  return (
    <AnimatedModal
      id="EventLogViewer"
      title="Event Log Viewer"
      modalClass="max-w-full h-full flex flex-col overflow-hidden"
      // deliberately no beforeShow reset. AnimatedModal re-runs its visibility
      // effect whenever it mounts, and a hot reload remounts it while the modal
      // store still says open - so a reset hook here wipes the loaded log on
      // every save, which is the exact thing the separate state module exists
      // to prevent. clearing is an explicit button instead
    >
      <Show when={stage() === "input"}>
        <div class="flex flex-col gap-4">
          <textarea
            class="bg-bg-secondary h-64 w-full rounded p-2 font-mono text-xs text-text"
            placeholder='{"version": 1, "events": [...], "context": {...}}'
            value={raw()}
            onInput={(e) => setRaw(e.currentTarget.value)}
            autocomplete="off"
          ></textarea>
          <Show when={err()}>
            <div class="text-sm text-error">{err()}</div>
          </Show>
          <div class="flex justify-end gap-2">
            <Button
              variant="button"
              onClick={onLoadLatest}
              fa={{ icon: "fa-download" }}
              text="Load latest data"
              balloon={{ text: "Load the event log from the last test" }}
            />
            <Button
              variant="button"
              onClick={resetEventLogViewer}
              fa={{ icon: "fa-trash" }}
              text="Clear"
              balloon={{
                text: "Throw away the loaded log, marks and video. State is kept across closing the modal and across hot reloads, so this is the only thing that clears it.",
              }}
            />
            <Button
              variant="button"
              onClick={() => hideModal("EventLogViewer")}
              text="Cancel"
            />
            <Button variant="button" onClick={onShow} text="Show" />
          </div>
        </div>
      </Show>
      <Show when={stage() === "preview" && ctx() !== null}>
        <PreviewContent
          ctx={ctx() as EventLog}
          onBack={() => setStage("input")}
        />
      </Show>
    </AnimatedModal>
  );
}
