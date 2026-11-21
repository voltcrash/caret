import { createAppSignal } from "#app/state.ts";
import { EventLog } from "@caret/web-shared/events/types";

export const [getLastEventLog, setLastEventLog] =
  createAppSignal<EventLog | null>(null);
