import { mutateUser } from "../../db/mutation";
import { statement } from "../../db/client";
import { MonkeyResponse } from "../../utils/monkey-response";
import * as UserDal from "../../dal/user";
import Logger from "../../utils/logger";
import * as DateUtils from "date-fns";
import { UTCDate } from "@date-fns/utc";
import * as ResultDal from "../../dal/result";
import { newId } from "../../utils/id";
import * as LeaderboardDal from "../../dal/leaderboards";
import MonkeyError from "../../utils/error";

import { Mode, PersonalBest, PersonalBests } from "@oxytype/schemas/shared";
import {
  AddDebugInboxItemRequest,
  GenerateDataRequest,
  GenerateDataResponse,
} from "@oxytype/contracts/dev";
import { buildMonkeyMail } from "../../utils/monkey-mail";
import { roundTo2 } from "@oxytype/util/numbers";
import type { ServiceContext, OperationInput } from "../context";
import { DBResult } from "../../utils/result";
import { LbPersonalBests } from "../../utils/pb";
import { Language } from "@oxytype/schemas/languages";

const CREATE_RESULT_DEFAULT_OPTIONS = {
  firstTestTimestamp: DateUtils.startOfDay(new UTCDate(Date.now())).valueOf(),
  lastTestTimestamp: DateUtils.endOfDay(new UTCDate(Date.now())).valueOf(),
  minTestsPerDay: 0,
  maxTestsPerDay: 50,
};

export async function createTestData(
  _context: ServiceContext,
  input: OperationInput<undefined, GenerateDataRequest>,
): Promise<GenerateDataResponse> {
  const { username } = input.body;
  const user = await UserDal.findByName(username);
  if (!user) throw new MonkeyError(404, `User ${username} does not exist.`);

  const { uid, email } = user;

  await createTestResults(user, input.body);
  await updateUser(uid);
  await updateLeaderboard();

  return new MonkeyResponse("test data created", { uid, email });
}

export async function addDebugInboxItem(
  context: ServiceContext,
  input: OperationInput<undefined, AddDebugInboxItemRequest>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const { rewardType } = input.body;
  const inboxConfig = context.configuration.users.inbox;

  const rewards =
    rewardType === "xp"
      ? [{ type: "xp" as const, item: 1000 }]
      : rewardType === "badge"
        ? [{ type: "badge" as const, item: { id: 1 } }]
        : [];

  const body =
    rewardType === "xp"
      ? "Here is your 1000 XP reward for debugging."
      : rewardType === "badge"
        ? "Here is your Developer badge reward."
        : "A debug inbox item with no reward.";

  const mail = buildMonkeyMail({
    subject: "Debug Inbox Item",
    body,
    rewards,
  });

  await UserDal.addToInbox(uid, [mail], inboxConfig);
  return new MonkeyResponse("Debug inbox item added", null);
}

async function createTestResults(
  user: UserDal.DBUser,
  configOptions: GenerateDataRequest,
): Promise<void> {
  const config = {
    ...CREATE_RESULT_DEFAULT_OPTIONS,
    ...configOptions,
  };
  const start = toDate(config.firstTestTimestamp);
  const end = toDate(config.lastTestTimestamp);

  const days = DateUtils.eachDayOfInterval({
    start,
    end,
  }).map((day) => ({
    timestamp: DateUtils.startOfDay(day),
    amount: Math.round(random(config.minTestsPerDay, config.maxTestsPerDay)),
  }));

  for (const day of days) {
    Logger.success(
      `User ${user.name} insert ${day.amount} results on ${new Date(
        day.timestamp,
      )}`,
    );
    const results = createArray(day.amount, () =>
      createResult(user, day.timestamp),
    );
    if (results.length > 0) {
      for (const result of results) await ResultDal.addResult(user.uid, result);
    }
  }
}

function toDate(value: number): Date {
  return new UTCDate(value);
}

function random(min: number, max: number): number {
  return roundTo2(Math.random() * (max - min) + min);
}

function createResult(
  user: UserDal.DBUser,
  timestamp: Date, //evil, we modify this value
): DBResult {
  const mode: Mode = randomValue(["time", "words"]);
  const mode2: number =
    mode === "time"
      ? randomValue([15, 30, 60, 120])
      : randomValue([10, 25, 50, 100]);
  const testDuration = mode2;

  timestamp = DateUtils.addSeconds(timestamp, testDuration);
  return {
    _id: newId(),
    uid: user.uid,
    wpm: random(80, 120),
    rawWpm: random(80, 120),
    charStats: [131, 0, 0, 0],
    acc: random(80, 100),
    language: "english",
    mode: mode,
    mode2: mode2 as unknown as never,
    timestamp: timestamp.valueOf(),
    testDuration: testDuration,
    consistency: random(80, 100),
    keyConsistency: 33.18,
    chartData: {
      wpm: createArray(testDuration, () => random(80, 120)),
      burst: createArray(testDuration, () => random(80, 120)),
      err: createArray(testDuration, () => (Math.random() < 0.1 ? 1 : 0)),
    },
    keySpacingStats: {
      average: 113.88,
      sd: 77.3,
    },
    keyDurationStats: {
      average: 107.13,
      sd: 39.86,
    },
    isPb: Math.random() < 0.1,
    name: user.name,
  };
}

async function updateUser(uid: string): Promise<void> {
  //update timetyping and completedTests
  const stats = (
    await statement(
      "SELECT language,mode,mode2,sum(json_extract(data,'$.testDuration')) AS timeTyping,count(*) AS completedTests FROM results WHERE uid=? GROUP BY language,mode,mode2",
      uid,
    ).all<{
      language: Language;
      mode: Mode;
      mode2: DBResult["mode2"];
      timeTyping: number;
      completedTests: number;
    }>()
  ).results;

  const timeTyping = stats.reduce((a, c) => a + c.timeTyping, 0);
  const completedTests = stats.reduce((a, c) => a + c.completedTests, 0);

  //update PBs
  const lbPersonalBests: LbPersonalBests = {
    time: {
      15: {},
      60: {},
    },
  };

  const personalBests: PersonalBests = {
    time: {},
    custom: {},
    words: {},
    zen: {},
    quote: {},
  };
  for (const mode of stats) {
    const raw = await statement(
      "SELECT data FROM results WHERE uid=? AND language=? AND mode=? AND mode2=? ORDER BY wpm DESC,timestamp ASC LIMIT 1",
      uid,
      mode.language,
      mode.mode,
      mode.mode2,
    ).first<string>("data");
    if (raw === null) continue;
    const best = JSON.parse(raw) as DBResult;

    personalBests[mode.mode] ??= {};
    if (personalBests[mode.mode][mode.mode2] === undefined) {
      personalBests[mode.mode][mode.mode2] = [];
    }

    const entry = {
      acc: best.acc,
      consistency: best.consistency,
      difficulty: best.difficulty ?? "normal",
      lazyMode: best.lazyMode,
      language: mode.language,
      punctuation: best.punctuation,
      raw: best.rawWpm,
      wpm: best.wpm,
      numbers: best.numbers,
      timestamp: best.timestamp,
    } as PersonalBest;

    (personalBests[mode.mode][mode.mode2] as PersonalBest[]).push(entry);

    if (mode.mode === "time") {
      const timeBests: Record<
        string,
        Record<string, PersonalBest> | undefined
      > = lbPersonalBests.time;
      const group = (timeBests[mode.mode2] ??= {});
      group[mode.language] = entry;
    }

    //update testActivity
    await updateTestActivity(uid);
  }

  //update the user
  await mutateUser(uid, (user) => {
    Object.assign(user, {
      timeTyping,
      completedTests,
      startedTests: Math.round(completedTests * 1.25),
      personalBests,
      lbPersonalBests,
    });
  });
}

async function updateLeaderboard(): Promise<void> {
  await LeaderboardDal.update("time", "15", "english");
  await LeaderboardDal.update("time", "60", "english");
}

function randomValue<T>(values: T[]): T {
  const rnd = Math.round(Math.random() * (values.length - 1));
  return values[rnd] as T;
}

function createArray<T>(size: number, builder: () => T): T[] {
  return new Array(size).fill(0).map(() => builder());
}

async function updateTestActivity(uid: string): Promise<void> {
  await statement("DELETE FROM user_activity WHERE uid=?", uid).run();
  await statement(
    "INSERT INTO user_activity(uid,day,count) SELECT uid,CAST(timestamp/86400000 AS INT),count(*) FROM results WHERE uid=? GROUP BY uid,2",
    uid,
  ).run();
  const rows = await statement(
    "SELECT day,count FROM user_activity WHERE uid=? ORDER BY day",
    uid,
  ).all<{ day: number; count: number }>();
  await mutateUser(uid, (user) => {
    user.testActivity = {};
    for (const row of rows.results) {
      const date = new UTCDate(row.day * 86400000),
        year = date.getFullYear(),
        index = DateUtils.getDayOfYear(date) - 1;
      const days = (user.testActivity[year] ??= []);
      while (days.length <= index) days.push(0);
      days[index] = row.count;
    }
  });
}
