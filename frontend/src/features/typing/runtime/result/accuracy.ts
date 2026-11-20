import { getLastEventLog } from "#shared/states/test.ts";
import { getAccuracy } from "#shared/engine/analysis.client.ts";

export function getEventLogAccuracy(): {
  correct: number;
  incorrect: number;
} | null {
  const eventLog = getLastEventLog();
  return eventLog === null ? null : getAccuracy(eventLog);
}
