import * as DateTime from "../utils/date-and-time";

let seconds = 0;
let addedAllToday = false;
let dayToday: number;

export function addSeconds(s: number): void {
  if (addedAllToday) {
    const nowDate = new Date().getDate();
    if (nowDate > dayToday) {
      seconds = s;
      return;
    }
  }
  seconds += s;
}

export function getString(): string {
  const secString = DateTime.secondsToString(Math.round(seconds), true, true);
  return secString + (addedAllToday ? " today" : " session");
}

export async function addAllFromToday(): Promise<void> {
  const { getResultsSinceDayOnce } = await import("../collections/results");
  const todayDate = new Date();
  todayDate.setSeconds(0);
  todayDate.setMinutes(0);
  todayDate.setHours(0);
  todayDate.setMilliseconds(0);
  dayToday = todayDate.getDate();
  const todayDateMS = todayDate.getTime();

  const results = await getResultsSinceDayOnce(todayDateMS);

  seconds = 0;
  for (const result of results) {
    seconds +=
      result.testDuration + result.incompleteTestSeconds - result.afkDuration;
  }

  addedAllToday = true;
}
