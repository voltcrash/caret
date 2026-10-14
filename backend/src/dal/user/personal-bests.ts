import { clientProfile, clientBoard } from "../../db/client-profile";

import { canFunboxGetPb, checkAndUpdatePb } from "../../utils/pb";

import { statement, encode } from "../../db/client";
import { mutateUser, stage } from "../../db/mutation";

import type {
  Client,
  Mode,
  Mode2,
  PersonalBest,
} from "@oxytype/schemas/shared";
import type { Result as ResultType } from "@oxytype/schemas/results";

import type { DBUser } from "./types";
import { emptyPb } from "./empty-pb";
import { getUser } from "./queries";

type Result = Omit<ResultType<Mode>, "_id" | "name">;
export async function clearPb(
  uid: string,
  client: Client = "web",
): Promise<void> {
  await mutateUser(uid, async (user) => {
    const profile = clientProfile(user, client);
    profile.personalBests = emptyPb();
    profile.lbPersonalBests = { time: {} };
    await stage(
      statement(
        "DELETE FROM leaderboard_bests WHERE uid=? AND ((?='web' AND board NOT LIKE 'tui:%') OR (?='tui' AND board LIKE 'tui:%'))",
        uid,
        client,
        client,
      ),
    );
  });
}
export async function optOutOfLeaderboards(uid: string): Promise<void> {
  await mutateUser(uid, async (user) => {
    user.lbOptOut = true;
    user.lbPersonalBests = { time: {} };
    for (const profile of Object.values(user.clientProfiles ?? {})) {
      profile.lbPersonalBests = { time: {} };
    }
    for (const table of [
      "leaderboard_bests",
      "daily_entries",
      "weekly_entries",
    ]) {
      await stage(statement(`DELETE FROM ${table} WHERE uid=?`, uid));
    }
  });
}
export async function updateLbMemory(
  uid: string,
  mode: Mode,
  mode2: Mode2<Mode>,
  language: string,
  rank: number,
  client: Client = "web",
): Promise<void> {
  await mutateUser(uid, (user) => {
    const profile = clientProfile(user, client);
    profile.lbMemory ??= {};
    profile.lbMemory[mode] ??= {};
    profile.lbMemory[mode][mode2] ??= {};
    profile.lbMemory[mode][mode2][language] = rank;
  });
}
function pbEligible(result: Result): boolean {
  return (
    result.offline !== true &&
    canFunboxGetPb(result) &&
    !(
      "stopOnLetter" in result &&
      result.stopOnLetter === true &&
      result.acc < 100
    ) &&
    result.mode !== "quote"
  );
}
export async function checkIfPb(
  uid: string,
  _user: Pick<DBUser, "personalBests" | "lbPersonalBests">,
  result: Result,
): Promise<boolean> {
  if (!pbEligible(result)) return false;
  return await mutateUser(uid, async (user) => {
    const profile = clientProfile(user, result.client);
    const pb = checkAndUpdatePb(
      profile.personalBests ?? emptyPb(),
      profile.lbPersonalBests ?? { time: {} },
      result,
    );
    profile.personalBests = pb.personalBests;
    profile.lbPersonalBests = pb.lbPersonalBests;
    const duration = Number(result.mode2),
      language = result.language ?? "english";
    const best = profile.lbPersonalBests?.time[duration]?.[language];
    if (result.mode === "time" && best !== undefined) {
      await stage(
        statement(
          "INSERT INTO leaderboard_bests(uid,board,wpm,acc,timestamp,data) VALUES(?,?,?,?,?,?) ON CONFLICT(uid,board) DO UPDATE SET wpm=excluded.wpm,acc=excluded.acc,timestamp=excluded.timestamp,data=excluded.data",
          uid,
          clientBoard(`${language}_time_${duration}`, result.client),
          best.wpm,
          best.acc,
          best.timestamp,
          encode(best),
        ),
      );
    }
    return pb.isPb;
  });
}
export async function checkIfTagPb(
  uid: string,
  _user: Pick<DBUser, "tags">,
  result: Result,
): Promise<string[]> {
  if (!pbEligible(result)) return [];
  return await mutateUser(uid, (user) => {
    const profile = clientProfile(user, result.client);
    const updated: string[] = [];
    for (const tag of user.tags ?? []) {
      if (!result.tags?.includes(tag._id)) continue;
      const pb = checkAndUpdatePb(
        (result.client === "tui"
          ? profile.tagPersonalBests?.[tag._id]
          : tag.personalBests) ?? emptyPb(),
        undefined,
        result,
      );
      if (pb.isPb) {
        if (result.client === "tui") {
          (profile.tagPersonalBests ??= {})[tag._id] = pb.personalBests;
        } else {
          tag.personalBests = pb.personalBests;
        }
        updated.push(tag._id);
      }
    }
    return updated;
  });
}
export async function getPersonalBests(
  uid: string,
  mode: string,
  mode2?: string,
  client: Client = "web",
): Promise<PersonalBest> {
  const user = await getUser(uid, "get personal bests");
  const profile = clientProfile(user, client);
  return (mode2 === undefined
    ? (profile.personalBests as Record<string, Record<string, PersonalBest[]>>)[
        mode
      ]
    : (profile.personalBests as Record<string, Record<string, PersonalBest[]>>)[
        mode
      ]?.[mode2]) as unknown as PersonalBest;
}
