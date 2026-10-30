import MonkeyError from "../../utils/error";
import { newId } from "../../utils/id";
import { database, statement, isUniqueViolation } from "../../db/client";
import { currentUserDraft, mutateUser, stage } from "../../db/mutation";
import { users } from "../../db/schema";
import { getCachedConfiguration } from "../../init/configuration";

import type { DBUser } from "./types";
import { emptyPb } from "./empty-pb";
import { getUser } from "./queries";

export async function addUser(
  name: string,
  email: string,
  uid: string,
): Promise<void> {
  const user: DBUser = {
    _id: newId(),
    name,
    email,
    uid,
    addedAt: Date.now(),
    personalBests: emptyPb(),
    testActivity: {},
  };
  try {
    await database().insert(users).values({
      uid,
      id: user._id,
      name,
      nameKey: name.toLowerCase(),
      email,
      addedAt: user.addedAt,
      data: user,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new MonkeyError(
        409,
        "User document or name already exists",
        "addUser",
      );
    }
    throw error;
  }
}
export async function exists(uid: string): Promise<boolean> {
  if (currentUserDraft(uid) !== undefined) return true;
  return (
    (await statement(
      "SELECT 1 AS found FROM users WHERE uid=?",
      uid,
    ).first()) !== null
  );
}
export async function resetUser(uid: string): Promise<void> {
  await mutateUser(uid, async (user) => {
    if (user.banned) {
      throw new MonkeyError(403, "Banned users cannot reset their account");
    }
    Object.assign(user, {
      personalBests: emptyPb(),
      lbPersonalBests: { time: {} },
      completedTests: 0,
      startedTests: 0,
      timeTyping: 0,
      lbMemory: {},
      bananas: 0,
      profileDetails: { bio: "", keyboard: "", socialProfiles: {} },
      favoriteQuotes: {},
      customThemes: [],
      tags: [],
      xp: 0,
      streak: { length: 0, lastResultTimestamp: 0, maxLength: 0 },
      testActivity: {},
    });
    delete user.lbOptOut;
    for (const table of [
      "user_activity",
      "leaderboard_bests",
      "leaderboard_snapshots",
      "daily_entries",
      "weekly_entries",
      "results",
      "configs",
      "presets",
    ]) {
      await stage(statement(`DELETE FROM ${table} WHERE uid=?`, uid));
    }
  });
}
export async function updateName(
  uid: string,
  name: string,
  previousName: string,
): Promise<void> {
  if (name === previousName) {
    throw new MonkeyError(400, "New name is the same as the old name");
  }
  try {
    await mutateUser(uid, (user) => {
      user.name = name;
      user.lastNameChange = Date.now();
      delete user.needsToChangeName;
      (user.nameHistory ??= []).push(previousName);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new MonkeyError(409, "Username already taken", name);
    }
    throw error;
  }
}
export async function flagForNameChange(uid: string): Promise<void> {
  await mutateUser(uid, (user) => {
    user.needsToChangeName = true;
  });
}
export async function setBanned(uid: string, banned: boolean): Promise<void> {
  await mutateUser(uid, (user) => {
    if (banned) user.banned = true;
    else delete user.banned;
  });
}
export async function checkIfUserIsPremium(
  uid: string,
  override?: Pick<DBUser, "premium">,
): Promise<boolean> {
  if (!(await getCachedConfiguration(true)).users.premium.enabled) return false;
  const premium = (override ?? (await getUser(uid, "check premium"))).premium;
  return (
    premium?.expirationTimestamp === -1 ||
    (premium?.expirationTimestamp ?? 0) > Date.now()
  );
}
export async function logIpAddress(
  uid: string,
  ip: string,
  override?: Pick<DBUser, "ips">,
): Promise<void> {
  // Account loads already have a snapshot. Repeated requests from the same IP
  // need no profile rewrite, receipt or version conflict with result saves.
  if ((currentUserDraft(uid) ?? override)?.ips?.[0] === ip) return;
  await mutateUser(uid, (user) => {
    user.ips = [
      ip,
      ...(user.ips ?? []).filter((existing) => existing !== ip),
    ].slice(0, 10);
  });
}
