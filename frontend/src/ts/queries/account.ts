import type { GetUserResponse } from "@oxytype/contracts/users";
import { Client, PersonalBests } from "@oxytype/schemas/shared";
import { queryOptions } from "@tanstack/solid-query";

import { captureAccount } from "../../app/account-scope";
import { operation } from "../../data/operations";
import {
  getDefaultSnapshot,
  type Snapshot,
} from "../constants/default-snapshot";
import { ModifiableTestActivityCalendar } from "../elements/test-activity-calendar";
import { getUserId } from "../states/core";
import { getFirstDayOfTheWeek } from "../utils/date-and-time";
import { SnapshotInitError } from "../utils/snapshot-init-error";
import { baseKey } from "./utils/keys";
import { getQueryClient } from ".";

type UserData = GetUserResponse["data"];

/**
 * The signed-in actor's account as the browser uses it: the server DTO
 * normalized into snapshot fields. Tags and filter presets seed their own
 * collections, which own them afterwards.
 */
export type AccountData = Snapshot &
  Pick<UserData, "tags" | "resultFilterPresets">;

const firstDayOfTheWeek = getFirstDayOfTheWeek();

function toAccountData(userData: UserData): AccountData {
  const personalBests: PersonalBests = userData.personalBests ?? {
    time: {},
    words: {},
    quote: {},
    zen: {},
    custom: {},
  };
  for (const mode of ["time", "words", "quote", "zen", "custom"] as const) {
    personalBests[mode] ??= {};
  }
  return {
    // Like the former snapshot: identity fields stay at their defaults.
    ...getDefaultSnapshot(),
    name: userData.name,
    personalBests,
    banned: userData.banned,
    lbOptOut: userData.lbOptOut,
    verified: userData.verified,
    needsToChangeName: userData.needsToChangeName,
    typingStats: {
      timeTyping: userData.timeTyping ?? 0,
      startedTests: userData.startedTests ?? 0,
      completedTests: userData.completedTests ?? 0,
    },
    quoteMod: userData.quoteMod,
    favoriteQuotes: userData.favoriteQuotes ?? {},
    quoteRatings: userData.quoteRatings,
    details: userData.profileDetails,
    addedAt: userData.addedAt,
    inventory: userData.inventory,
    xp: userData.xp ?? 0,
    inboxUnreadSize: userData.inboxUnreadSize ?? 0,
    streak: userData.streak?.length ?? 0,
    maxStreak: userData.streak?.maxLength ?? 0,
    isPremium: userData.isPremium ?? false,
    allTimeLbs: userData.allTimeLbs,
    testActivity:
      userData.testActivity === undefined
        ? undefined
        : new ModifiableTestActivityCalendar(
            userData.testActivity.testsByDays,
            new Date(userData.testActivity.lastDay),
            firstDayOfTheWeek,
          ),
    streakHourOffset: userData.streak?.hourOffset ?? undefined,
    ...(userData.lbMemory === undefined ? {} : { lbMemory: userData.lbMemory }),
    tags: userData.tags,
    resultFilterPresets: userData.resultFilterPresets,
  };
}

function accountKey(client: Client, userId: string | null): unknown[] {
  return [...baseKey("account", { isUserSpecific: true }), userId, client];
}

/**
 * The actor's canonical web account. Loaded once per identity, then updated
 * only by explicit cache writes (local result acknowledgements, profile
 * edits); it lives until the actor changes.
 */
export function getAccountQueryOptions(userId: string | null = getUserId()) {
  return queryOptions({
    queryKey: accountKey("web", userId),
    queryFn: async (): Promise<AccountData> => {
      const response = await operation("users.get", {
        query: { client: "web" },
      });
      if (!response.ok) {
        throw new SnapshotInitError(
          `${response.message} (user)`,
          response.status,
        );
      }
      return toAccountData(response.data);
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** The terminal client's partition of the same account, for its profile/boards. */
export function getTerminalAccountQueryOptions() {
  return queryOptions({
    queryKey: accountKey("tui", getUserId()),
    queryFn: async () => {
      const response = await operation("users.get", {
        query: { client: "tui" },
      });
      if (!response.ok) throw new Error(response.message);
      const data = response.data;
      return {
        ...data,
        details: data.profileDetails,
        typingStats: {
          startedTests: data.startedTests ?? 0,
          completedTests: data.completedTests ?? 0,
          timeTyping: data.timeTyping ?? 0,
        },
        streak: data.streak?.length ?? 0,
        maxStreak: data.streak?.maxLength ?? 0,
      };
    },
    staleTime: 30_000,
  });
}

/**
 * The actor's account, fetched at most once while cached; concurrent
 * consumers (snapshot, tags, filter presets) share one request. Rejects with
 * AbortError if the actor changes before it settles.
 */
export async function loadAccountData(
  userId = getUserId(),
): Promise<AccountData | undefined> {
  if (userId === null) return undefined;
  const lease = captureAccount();
  try {
    const data = await getQueryClient().query({
      ...getAccountQueryOptions(userId),
      staleTime: "static",
    });
    lease.assertCurrent();
    return data;
  } catch (error) {
    // An actor change cancels the request; report it as the lease ending.
    lease.assertCurrent();
    throw error;
  }
}

export async function updateTerminalLeaderboardMemory(
  mode2: string,
  rank: number,
): Promise<void> {
  const key = getTerminalAccountQueryOptions().queryKey;
  const response = await operation("users.updateLeaderboardMemory", {
    query: { client: "tui" },
    body: { mode: "time", mode2, language: "english", rank },
  });
  if (!response.ok) throw new Error(response.message);
  getQueryClient().setQueryData(key, (data) =>
    data === undefined
      ? data
      : {
          ...data,
          lbMemory: {
            ...data.lbMemory,
            time: {
              ...data.lbMemory?.time,
              [mode2]: { ...data.lbMemory?.time?.[mode2], english: rank },
            },
          },
        },
  );
}

export function getAccountActivityQueryOptions(client: Client) {
  return queryOptions({
    queryKey: [
      ...baseKey("activity", { isUserSpecific: true }),
      getUserId(),
      client,
    ],
    queryFn: async () => {
      const response = await operation("users.getTestActivity", {
        query: { client },
      });
      if (!response.ok) throw new Error(response.message);
      return response.data;
    },
    staleTime: 30_000,
  });
}
