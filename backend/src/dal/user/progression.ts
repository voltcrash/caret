import { statement } from "../../db/client";
import { mutateUser, stage } from "../../db/mutation";

import { getDayOfYear } from "date-fns";
import { UTCDate } from "@date-fns/utc";
import type { UserStreak } from "@caret/schemas/users";
import type { Client } from "@caret/schemas/shared";

import {
  getStartOfDayTimestamp,
  MILLISECONDS_IN_DAY,
} from "@caret/util/date-and-time";
import { addImportantLog } from ".././logs";

import type { DBUser } from "./types";

import { getPartialUser } from "./queries";

export async function setSuspicious(uid: string): Promise<void> {
  await mutateUser(uid, (user) => {
    user.suspicious = true;
  });
}
export async function clearSuspicious(uid: string): Promise<void> {
  await mutateUser(uid, (user) => {
    delete user.suspicious;
  });
}
export async function updateLastTimingHashes(
  uid: string,
  lastTimingHashes: string[],
): Promise<void> {
  await mutateUser(uid, (user) => {
    user.lastTimingHashes = lastTimingHashes;
  });
}
export async function updateTypingStats(
  uid: string,
  restartCount: number,
  timeTyping: number,
  _client: Client = "web",
): Promise<void> {
  await mutateUser(uid, (user) => {
    const profile = user;
    profile.startedTests = (profile.startedTests ?? 0) + restartCount + 1;
    profile.completedTests = (profile.completedTests ?? 0) + 1;
    profile.timeTyping = (profile.timeTyping ?? 0) + timeTyping;
  });
}
export async function incrementBananas(
  uid: string,
  wpm: number,
  _client: Client = "web",
): Promise<void> {
  await mutateUser(uid, (user) => {
    const profile = user;
    const pbs = profile.personalBests?.time[60];
    if (
      pbs !== undefined &&
      pbs.length > 0 &&
      wpm >= Math.max(...pbs.map((pb) => pb.wpm)) * 0.75
    ) {
      profile.bananas = (profile.bananas ?? 0) + 1;
    }
  });
}
export async function incrementXp(
  uid: string,
  xp: number,
  _client: Client = "web",
): Promise<void> {
  await mutateUser(uid, (user) => {
    const profile = user;
    profile.xp = (profile.xp ?? 0) + (Number.isFinite(xp) ? Math.trunc(xp) : 0);
  });
}
export async function incrementTestActivity(
  user: DBUser,
  timestamp: number,
  client: Client = "web",
): Promise<void> {
  if (user.testActivity === undefined) return;
  await mutateUser(user.uid, async (current) => {
    const date = new UTCDate(timestamp),
      year = date.getFullYear(),
      index = getDayOfYear(date) - 1;
    const profile = current;
    profile.testActivity ??= {};
    const days = (profile.testActivity[year] ??= []);
    while (days.length <= index) days.push(0);
    days[index] = (days[index] ?? 0) + 1;
    await stage(
      statement(
        "INSERT INTO user_activity(uid,client,day,count) VALUES(?,?,?,1) ON CONFLICT(uid,client,day) DO UPDATE SET count=count+1",
        user.uid,
        client,
        Math.floor(timestamp / 86400000),
      ),
    );
  });
}
export async function recordAutoBanEvent(
  uid: string,
  maxCount: number,
  maxHours: number,
): Promise<boolean> {
  return await mutateUser(uid, async (user) => {
    if (user.banned) return false;
    const now = Date.now();
    user.autoBanTimestamps = (user.autoBanTimestamps ?? []).filter(
      (timestamp) => timestamp >= now - maxHours * 3600000,
    );
    user.autoBanTimestamps.push(now);
    const banned = user.autoBanTimestamps.length > maxCount;
    if (banned) user.banned = true;
    await addImportantLog(
      "user_auto_banned",
      { autoBanTimestamps: user.autoBanTimestamps, banningUser: banned },
      uid,
    );
    return banned;
  });
}
export async function updateStreak(
  uid: string,
  timestamp: number,
  _client: Client = "web",
): Promise<number> {
  return await mutateUser(uid, async (user) => {
    const profile = user;
    const streak: UserStreak = {
      lastResultTimestamp: profile.streak?.lastResultTimestamp ?? 0,
      length: profile.streak?.length ?? 0,
      maxLength: profile.streak?.maxLength ?? 0,
      hourOffset: profile.streak?.hourOffset,
    };
    // Delayed/out-of-order uploads must not move a streak backwards.
    if (timestamp <= streak.lastResultTimestamp) return streak.length;
    const offset = (streak.hourOffset ?? 0) * 3600000;
    const day = getStartOfDayTimestamp(timestamp, offset);
    const previousDay = getStartOfDayTimestamp(
      streak.lastResultTimestamp,
      offset,
    );
    if (day - previousDay === MILLISECONDS_IN_DAY) {
      streak.length++;
    } else if (day !== previousDay || streak.length === 0) {
      await addImportantLog("streak_lost", streak, uid);
      streak.length = 1;
    }
    streak.maxLength = Math.max(streak.length, streak.maxLength);
    streak.lastResultTimestamp = timestamp;
    if (streak.hourOffset === 0) delete streak.hourOffset;
    profile.streak = streak;
    return streak.length;
  });
}
export async function setStreakHourOffset(
  uid: string,
  hourOffset: number,
  _client: Client = "web",
): Promise<void> {
  await mutateUser(uid, (user) => {
    const profile = user;
    profile.streak ??= { length: 0, maxLength: 0, lastResultTimestamp: 0 };
    profile.streak.hourOffset = hourOffset;
    profile.streak.lastResultTimestamp = Date.now();
  });
}
export async function clearStreakHourOffset(uid: string): Promise<void> {
  await mutateUser(uid, (user) => {
    if (user.streak) delete user.streak.hourOffset;
  });
}
export async function getStats(
  uid: string,
  client: Client = "web",
): Promise<Pick<DBUser, "startedTests" | "completedTests" | "timeTyping">> {
  return await getPartialUser(
    uid,
    "get stats",
    ["startedTests", "completedTests", "timeTyping"],
    client,
  );
}
