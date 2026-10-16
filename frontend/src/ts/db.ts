import { captureAccount } from "../app/account-scope";
import { operation } from "../data/operations";
import { showErrorNotification } from "./states/notifications";
import { isAuthenticated } from "./states/core";
import * as Dates from "date-fns";
import { TestActivityCalendar } from "./elements/test-activity-calendar";
import { showLoaderBar, hideLoaderBar } from "./states/loader-bar";
import { Badge } from "@oxytype/schemas/users";
import type { GetTestActivityResponse } from "@oxytype/contracts/users";
import { Difficulty } from "@oxytype/schemas/configs";
import { Mode, Mode2, PersonalBest } from "@oxytype/schemas/shared";
import { Snapshot, SavedResult } from "./constants/default-snapshot";
import { getFirstDayOfTheWeek } from "./utils/date-and-time";
import { Language } from "@oxytype/schemas/languages";
import { authEvent } from "./events/auth";
import { sync as syncServerConfiguration } from "./states/server-configuration";
import { setLastResult } from "./states/snapshot";
import { XpBreakdown } from "@oxytype/schemas/results";
import { setXpBarData } from "./states/header";
import { FunboxMetadata } from "@oxytype/funbox";
import { getQueryClient } from "./queries";
import {
  type AccountData,
  getAccountActivityQueryOptions,
  getAccountQueryOptions,
  loadAccountData,
} from "./queries/account";
import { SnapshotInitError } from "./utils/snapshot-init-error";
import { updateTagsInFilterStorage } from "./states/result-filters";
import { emptyPersonalBests, personalBestList } from "./utils/personal-bests";

const firstDayOfTheWeek = getFirstDayOfTheWeek();

function accountKey(): readonly unknown[] {
  return getAccountQueryOptions().queryKey;
}

/** The actor's web account (query-owned), or undefined before it loads. */
function getAccount(): AccountData | undefined {
  return getQueryClient().getQueryData<AccountData>(accountKey());
}

export function getSnapshot(): Snapshot | undefined {
  return getAccount();
}

/** Apply an accepted favorite mutation to the current canonical account. */
export function updateLocalQuoteFavorite(
  language: Language,
  quoteId: string,
  favorite: boolean,
): void {
  const snapshot = getSnapshot();
  if (snapshot === undefined) return;
  const ids = snapshot.favoriteQuotes?.[language] ?? [];
  setSnapshot({
    ...snapshot,
    favoriteQuotes: {
      ...snapshot.favoriteQuotes,
      [language]: favorite
        ? [...new Set([...ids, quoteId])]
        : ids.filter((id) => id !== quoteId),
    },
  });
}

/**
 * Explicit cache write for a local acknowledgement or profile edit. Server
 * moderation fields (banned, verified, leaderboard opt-out) keep their
 * loaded values.
 */
export function setSnapshot(
  newSnapshot: Snapshot | undefined,
  options?: { dispatchEvent?: boolean },
): void {
  const client = getQueryClient();
  if (newSnapshot === undefined) {
    // Resetting (not removing) also clears the reactive view's observer.
    void client.resetQueries({ queryKey: accountKey(), exact: true });
  } else {
    const previous = getAccount();
    client.setQueryData<AccountData>(accountKey(), {
      ...previous,
      ...newSnapshot,
      banned: previous?.banned,
      verified: previous?.verified,
      lbOptOut: previous?.lbOptOut,
    });
  }

  if (options?.dispatchEvent !== false) {
    authEvent.dispatch({ type: "snapshotUpdated", data: { isInitial: false } });
  }
}

/** Load the account (and server configuration) for the current actor. */
export async function initSnapshot(): Promise<Snapshot | false> {
  if (!isAuthenticated()) return false;
  const [account] = await Promise.all([
    loadAccountData(),
    syncServerConfiguration(),
  ]);
  if (account === undefined) {
    throw new SnapshotInitError(
      `Request was successful but user data is null/undefined`,
      200,
    );
  }
  updateTagsInFilterStorage(account.tags?.map((it) => it._id) ?? []);
  return account;
}
export function getLocalPB<M extends Mode>(
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: string,
  difficulty: Difficulty,
  lazyMode: boolean,
  funboxes: FunboxMetadata[],
): PersonalBest | undefined {
  if (!funboxes.every((f) => f.canGetPb)) {
    return undefined;
  }

  const pbs = getSnapshot()?.personalBests?.[mode]?.[mode2] as
    | PersonalBest[]
    | undefined;

  return pbs?.find(
    (pb) =>
      (pb.punctuation ?? false) === punctuation &&
      (pb.numbers ?? false) === numbers &&
      pb.difficulty === difficulty &&
      pb.language === language &&
      (pb.lazyMode ?? false) === lazyMode,
  );
}

function saveLocalPB<M extends Mode>(
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: Language,
  difficulty: Difficulty,
  lazyMode: boolean,
  wpm: number,
  acc: number,
  raw: number,
  consistency: number,
): void {
  if (mode === "quote") return;
  const dbSnapshot = getSnapshot();
  if (!dbSnapshot) return;
  function cont(): void {
    if (!dbSnapshot) return;
    dbSnapshot.personalBests ??= emptyPersonalBests();
    const list = personalBestList(dbSnapshot.personalBests, mode, mode2);
    const matching = list.filter(
      (pb) =>
        (pb.punctuation ?? false) === punctuation &&
        (pb.numbers ?? false) === numbers &&
        pb.difficulty === difficulty &&
        pb.language === language &&
        (pb.lazyMode ?? false) === lazyMode,
    );
    for (const pb of matching) {
      Object.assign(pb, {
        wpm,
        acc,
        raw,
        timestamp: Date.now(),
        consistency,
        lazyMode,
      });
    }
    if (matching.length === 0) {
      list.push({
        language,
        difficulty,
        lazyMode,
        punctuation,
        numbers,
        wpm,
        acc,
        raw,
        timestamp: Date.now(),
        consistency,
      });
    }
  }

  if (dbSnapshot !== null) {
    cont();
  }
}

export async function updateLbMemory<M extends Mode>(
  mode: M,
  mode2: Mode2<M> | undefined,
  language: Language,
  rank: number,
  api = false,
): Promise<void> {
  if (mode2 === undefined) return;
  if (mode === "time") {
    const timeMode = mode;
    const timeMode2 = mode2 as "15" | "60";

    const snapshot = getSnapshot();
    if (!snapshot) return;
    snapshot.lbMemory ??= {
      time: { "15": { english: 0 }, "60": { english: 0 } },
    };
    snapshot.lbMemory[timeMode] ??= {
      "15": { english: 0 },
      "60": { english: 0 },
    };
    snapshot.lbMemory[timeMode][timeMode2] ??= {};
    const current = snapshot.lbMemory?.[timeMode]?.[timeMode2]?.[language];

    //this is protected above so not sure why it would be undefined
    const mem = snapshot.lbMemory[timeMode][timeMode2];
    mem[language] = rank;
    if (api && current !== rank) {
      await operation("users.updateLeaderboardMemory", {
        body: { mode, mode2, language, rank },
      });
    }
    setSnapshot(snapshot);
  }
}

export type SaveLocalResultData = {
  xp?: number;
  xpBreakdown?: XpBreakdown;
  streak?: number;
  result?: SavedResult;
  isPb?: boolean;
};

export function saveLocalResult(data: SaveLocalResultData): void {
  const lease = captureAccount();
  const snapshot = getSnapshot();
  if (!snapshot) return;

  if (data.result !== undefined) {
    const result = data.result;
    void import("./collections/results").then(async (m) =>
      lease.isCurrent() ? m.insertLocalResult({ result }) : undefined,
    );
    setLastResult(data.result);
    if (snapshot.testActivity !== undefined) {
      snapshot.testActivity.increment(new Date(data.result.timestamp));
    }
    snapshot.typingStats ??= {
      timeTyping: 0,
      startedTests: 0,
      completedTests: 0,
    };

    const time =
      data.result.testDuration +
      data.result.incompleteTestSeconds -
      data.result.afkDuration;

    snapshot.typingStats.timeTyping += time;
    snapshot.typingStats.startedTests += data.result.restartCount + 1;
    snapshot.typingStats.completedTests += 1;

    if (data.isPb) {
      saveLocalPB(
        data.result.mode,
        data.result.mode2,
        data.result.punctuation,
        data.result.numbers,
        data.result.language,
        data.result.difficulty,
        data.result.lazyMode,
        data.result.wpm,
        data.result.acc,
        data.result.rawWpm,
        data.result.consistency,
      );
    }
  }

  if (data.xp !== undefined) {
    snapshot.xp ??= 0;
    snapshot.xp += data.xp;
  }

  if (data.streak !== undefined) {
    snapshot.streak = data.streak;

    if (snapshot.streak > snapshot.maxStreak) {
      snapshot.maxStreak = snapshot.streak;
    }
  }

  setSnapshot(snapshot, {
    dispatchEvent: false,
  });
  if (data.xp !== undefined) {
    setXpBarData({
      addedXp: data.xp,
      resultingXp: snapshot.xp,
      breakdown: data.xpBreakdown,
    });
  }
}

export function addXp(xp: number, breakdown?: XpBreakdown): void {
  const snapshot = getSnapshot();
  if (!snapshot) return;

  snapshot.xp ??= 0;
  snapshot.xp += xp;
  setSnapshot(snapshot, {
    dispatchEvent: false,
  });
  setXpBarData({
    addedXp: xp,
    resultingXp: snapshot.xp,
    breakdown: breakdown,
  });
}

export function updateInboxUnreadSize(newSize: number): void {
  const snapshot = getSnapshot();
  if (!snapshot) return;

  snapshot.inboxUnreadSize = newSize;
  setSnapshot(snapshot);
}

export function addBadge(badge: Badge): void {
  const snapshot = getSnapshot();
  if (!snapshot) return;

  snapshot.inventory ??= {
    badges: [],
  };
  snapshot.inventory.badges.push(badge);
  setSnapshot(snapshot);
}

type ActivityArchive = NonNullable<GetTestActivityResponse["data"]>;
const archives = new WeakMap<
  ActivityArchive,
  Record<string, TestActivityCalendar>
>();

/** Derived once per loaded archive; the activity query owns the data. */
function archiveCalendars(
  data: ActivityArchive,
): Record<string, TestActivityCalendar> {
  let calendars = archives.get(data);
  if (calendars === undefined) {
    calendars = {};
    const currentYear = new Date().getFullYear().toString();
    for (const year in data) {
      if (year === currentYear) continue;
      const testsByDays = data[year] ?? [];
      const lastDay = Dates.addDays(
        new Date(parseInt(year), 0, 1),
        testsByDays.length,
      );
      calendars[year] = new TestActivityCalendar(
        testsByDays,
        lastDay,
        firstDayOfTheWeek,
        true,
      );
    }
    archives.set(data, calendars);
  }
  return calendars;
}

export async function getTestActivityCalendar(
  yearString: string,
): Promise<TestActivityCalendar | undefined> {
  const lease = captureAccount();
  const dbSnapshot = getSnapshot();
  if (!isAuthenticated() || dbSnapshot === undefined) return undefined;

  if (yearString === "current") return dbSnapshot.testActivity;

  const currentYear = new Date().getFullYear().toString();
  if (yearString === currentYear) {
    return dbSnapshot.testActivity?.getFullYearCalendar();
  }

  const options = {
    ...getAccountActivityQueryOptions("web"),
    staleTime: Infinity,
  };
  let data = getQueryClient().getQueryData(options.queryKey);
  if (data === undefined) {
    showLoaderBar();
    try {
      data = await getQueryClient().query(options);
    } catch (error) {
      lease.assertCurrent();
      showErrorNotification("Error getting test activities", { error });
      return undefined;
    } finally {
      hideLoaderBar();
    }
    lease.assertCurrent();
  }
  return data === null ? undefined : archiveCalendars(data)[yearString];
}
