import {
  getLocalMidnight,
  TypingTimeTracker,
} from "@caret/web-shared/typing-time";
import { captureAccount, createAccountOwned } from "../../../app/account-scope";
import * as DateTime from "../../../ts/utils/date-and-time";

const getTracker = createAccountOwned(() => new TypingTimeTracker());

export function addSeconds(s: number): void {
  getTracker().add(s);
}

export function getString(): string {
  const tracker = getTracker();
  const secString = DateTime.secondsToString(
    Math.round(tracker.getSeconds()),
    true,
    true,
  );
  return secString + (tracker.isToday() ? " today" : " session");
}

export async function addAllFromToday(): Promise<void> {
  const lease = captureAccount();
  const { getResultsSinceDayOnce } =
    await import("../../../data/collections/results");
  if (!lease.isCurrent()) return;
  const day = getLocalMidnight(new Date()).getTime();
  const results = await getResultsSinceDayOnce(day);
  if (!lease.isCurrent() || day !== getLocalMidnight(new Date()).getTime()) {
    return;
  }
  getTracker().loadToday(
    results.reduce((sum, result) => sum + result.timeTyping, 0),
  );
}
