import type { Client, PersonalBests } from "@oxytype/schemas/shared";
import type { DBUser } from "../dal/user";
import type { LbPersonalBests } from "../utils/pb";
import type {
  CountByYearAndDay,
  UserStreak,
  UserLbMemory,
} from "@oxytype/schemas/users";
import { statement } from "./client";

export type ClientProfile = {
  personalBests: PersonalBests;
  lbPersonalBests?: LbPersonalBests;
  completedTests?: number;
  startedTests?: number;
  timeTyping?: number;
  streak?: UserStreak;
  testActivity?: CountByYearAndDay;
  xp?: number;
  bananas?: number;
  lbMemory?: UserLbMemory;
  tagPersonalBests?: Record<string, PersonalBests>;
};
function emptyPersonalBests(): PersonalBests {
  return { time: {}, words: {}, quote: {}, zen: {}, custom: {} };
}
export function clientProfile(
  user: DBUser,
  client: Client = "web",
): ClientProfile {
  // Existing top-level fields remain the web cache for backward compatibility.
  if (client === "web") return user;
  return ((user.clientProfiles ??= {}).tui ??= {
    personalBests: emptyPersonalBests(),
    lbPersonalBests: { time: {} },
    completedTests: 0,
    startedTests: 0,
    timeTyping: 0,
    xp: 0,
    bananas: 0,
    lbMemory: {},
    testActivity: {},
    streak: { length: 0, maxLength: 0, lastResultTimestamp: 0 },
  });
}
export function extractClientProfile(user: DBUser): ClientProfile {
  const {
    personalBests,
    lbPersonalBests,
    completedTests,
    startedTests,
    timeTyping,
    streak,
    testActivity,
    xp,
    bananas,
    lbMemory,
  } = user;
  return {
    personalBests,
    lbPersonalBests,
    completedTests,
    startedTests,
    timeTyping,
    streak,
    testActivity,
    xp,
    bananas,
    lbMemory,
    tagPersonalBests: Object.fromEntries(
      (user.tags ?? []).map((tag) => [
        tag._id,
        tag.personalBests ?? emptyPersonalBests(),
      ]),
    ),
  };
}
export async function attachClientProfiles(user: DBUser): Promise<DBUser> {
  const rows = await statement(
    "SELECT client,data FROM client_profiles WHERE uid=? AND client='tui'",
    user.uid,
  ).all<{ client: Client; data: string }>();
  user.clientProfiles = Object.fromEntries(
    rows.results.map((row) => [
      row.client,
      JSON.parse(row.data) as ClientProfile,
    ]),
  );
  return user;
}
export function projectClientUser(
  user: DBUser,
  client: Client = "web",
): DBUser {
  if (client === "web") return user;
  const { tagPersonalBests, ...profile } = clientProfile(user, client);
  return {
    ...user,
    ...profile,
    personalBests: profile.personalBests ?? emptyPersonalBests(),
    completedTests: profile.completedTests ?? 0,
    startedTests: profile.startedTests ?? 0,
    timeTyping: profile.timeTyping ?? 0,
    xp: profile.xp ?? 0,
    bananas: profile.bananas ?? 0,
    streak: profile.streak ?? {
      length: 0,
      maxLength: 0,
      lastResultTimestamp: 0,
    },
    testActivity: profile.testActivity ?? {},
    lbMemory: profile.lbMemory ?? {},
    tags: user.tags?.map((tag) => ({
      ...tag,
      personalBests: tagPersonalBests?.[tag._id] ?? emptyPersonalBests(),
    })),
  };
}
export function clientBoard(key: string, client: Client = "web"): string {
  return client === "web" ? key : `${client}:${key}`;
}
