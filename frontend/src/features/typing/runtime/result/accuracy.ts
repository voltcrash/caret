import { getLastEventLog } from "../../../../ts/states/test";
import { getAccuracy } from "../../analysis.client";

export function getEventLogAccuracy(): {
  correct: number;
  incorrect: number;
} | null {
  const eventLog = getLastEventLog();
  return eventLog === null ? null : getAccuracy(eventLog);
}
