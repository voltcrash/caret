import {
  getLocalMidnight,
  TypingTimeTracker,
} from "@oxytype/typing-core/typing-time";
import * as DateTime from "../../../ts/utils/date-and-time";

const tracker = new TypingTimeTracker();

export function addSeconds(s: number): void {
  tracker.add(s);
}

export function getString(): string {
  const secString = DateTime.secondsToString(
    Math.round(tracker.getSeconds()),
    true,
    true,
  );
  return secString + (tracker.isToday() ? " today" : " session");
}

export async function addAllFromToday(): Promise<void> {
  const { getResultsSinceDayOnce } =
    await import("../../../ts/collections/results");
  const results = await getResultsSinceDayOnce(
    getLocalMidnight(new Date()).getTime(),
  );
  tracker.loadToday(results);
}
