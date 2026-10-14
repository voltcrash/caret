import { getLastEventLog } from "../../states/test";
import { getAccuracy } from "@oxytype/typing-core/events/stats";

export function getEventLogAccuracy(): {
  correct: number;
  incorrect: number;
} | null {
  const eventLog = getLastEventLog();
  return eventLog === null ? null : getAccuracy(eventLog);
}
