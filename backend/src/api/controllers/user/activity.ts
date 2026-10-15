import type { ClientQuery } from "@oxytype/schemas/shared";
import * as UserDAL from "../../../dal/user";
import MonkeyError from "../../../utils/error";
import { MonkeyResponse } from "../../../utils/monkey-response";
import * as Dates from "date-fns";
import { UTCDateMini } from "@date-fns/utc";
import { CountByYearAndDay, TestActivity } from "@oxytype/schemas/users";
import { addImportantLog } from "../../../dal/logs";
import {
  GetCurrentTestActivityResponse,
  GetStreakResponse,
  GetTestActivityResponse,
  SetStreakHourOffsetRequest,
} from "@oxytype/contracts/users";
import { MonkeyRequest } from "../../types";

export async function setStreakHourOffset(
  req: MonkeyRequest<ClientQuery, SetStreakHourOffsetRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { hourOffset } = req.body;

  const user = await UserDAL.getPartialUser(
    uid,
    "update user profile",
    ["streak"],
    req.query?.client,
  );

  if (
    user.streak?.hourOffset !== undefined &&
    user.streak?.hourOffset !== null
  ) {
    throw new MonkeyError(403, "Streak hour offset already set");
  }

  await UserDAL.setStreakHourOffset(uid, hourOffset, req.query?.client);

  void addImportantLog("user_streak_hour_offset_set", { hourOffset }, uid);

  return new MonkeyResponse("Streak hour offset set", null);
}
export function generateCurrentTestActivity(
  testActivity: CountByYearAndDay | undefined,
): TestActivity | undefined {
  const thisYear = Dates.startOfYear(new UTCDateMini());
  const lastYear = Dates.startOfYear(Dates.subYears(thisYear, 1));

  let thisYearData = testActivity?.[thisYear.getFullYear().toString()];
  let lastYearData = testActivity?.[lastYear.getFullYear().toString()];

  if (lastYearData === undefined && thisYearData === undefined) {
    return undefined;
  }

  lastYearData = lastYearData ?? [];
  thisYearData = thisYearData ?? [];

  //make sure lastYearData covers the full year
  if (lastYearData.length < Dates.getDaysInYear(lastYear)) {
    lastYearData.push(
      ...(new Array(Dates.getDaysInYear(lastYear) - lastYearData.length).fill(
        undefined,
      ) as (number | null)[]),
    );
  }
  //use enough days of the last year to have 372 days in total to always fill the first week of the graph
  lastYearData = lastYearData.slice(-372 + thisYearData.length);

  const lastDay = Dates.startOfDay(
    Dates.addDays(thisYear, thisYearData.length - 1),
  );

  return {
    testsByDays: [...lastYearData, ...thisYearData],
    lastDay: lastDay.valueOf(),
  };
}
export async function getTestActivity(
  req: MonkeyRequest<ClientQuery>,
): Promise<GetTestActivityResponse> {
  const { uid } = req.ctx.decodedToken;
  const premiumFeaturesEnabled = req.ctx.configuration.users.premium.enabled;
  const user = await UserDAL.getPartialUser(
    uid,
    "testActivity",
    ["testActivity", "premium"],
    req.query?.client,
  );
  const userHasPremium = await UserDAL.checkIfUserIsPremium(uid, user);

  if (!premiumFeaturesEnabled) {
    throw new MonkeyError(503, "Premium features are disabled");
  }

  if (!userHasPremium) {
    throw new MonkeyError(503, "User does not have premium");
  }

  return new MonkeyResponse(
    "Test activity data retrieved",
    user.testActivity ?? null,
  );
}
export async function getCurrentTestActivity(
  req: MonkeyRequest<ClientQuery>,
): Promise<GetCurrentTestActivityResponse> {
  const { uid } = req.ctx.decodedToken;

  const user = await UserDAL.getPartialUser(
    uid,
    "current test activity",
    ["testActivity"],
    req.query?.client,
  );
  const data = generateCurrentTestActivity(user.testActivity);
  return new MonkeyResponse(
    "Current test activity data retrieved",
    data ?? null,
  );
}
export async function getStreak(
  req: MonkeyRequest<ClientQuery>,
): Promise<GetStreakResponse> {
  const { uid } = req.ctx.decodedToken;

  const user = await UserDAL.getPartialUser(
    uid,
    "streak",
    ["streak"],
    req.query?.client,
  );

  return new MonkeyResponse("Streak data retrieved", user.streak ?? null);
}
