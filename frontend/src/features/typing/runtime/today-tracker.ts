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
    await import("../../../ts/collections/results");
  if (!lease.isCurrent()) return;
  const results = await getResultsSinceDayOnce(
    getLocalMidnight(new Date()).getTime(),
  );
  if (!lease.isCurrent()) return;
  getTracker().loadToday(results);
}
