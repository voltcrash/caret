import { generateCurrentTestActivity } from "./activity";
import { getAllTimeLbs } from "./leaderboards";
import type { ClientQuery } from "@oxytype/schemas/shared";
import * as UserDAL from "../../../dal/user";
import { MonkeyResponse } from "../../../utils/monkey-response";
import { buildAgentLog, omit } from "../../../utils/misc";
import { ResultFilters, User } from "@oxytype/schemas/users";
import { addLog } from "../../../dal/logs";
import {
  GetPersonalBestsQuery,
  GetPersonalBestsResponse,
  GetStatsResponse,
  GetUserResponse,
} from "@oxytype/contracts/users";
import { type ServiceContext, type OperationInput } from "../../context";

type RelevantUserInfo = Omit<
  UserDAL.DBUser,
  | "bananas"
  | "lbPersonalBests"
  | "inbox"
  | "nameHistory"
  | "lastNameChange"
  | "_id"
  | "lastTimingHashes"
  | "note"
  | "ips"
  | "testActivity"
  | "suspicious"
  | "clientProfiles"
>;
function getRelevantUserInfo(user: UserDAL.DBUser): RelevantUserInfo {
  return omit(user, [
    "bananas",
    "lbPersonalBests",
    "inbox",
    "nameHistory",
    "lastNameChange",
    "_id",
    "lastTimingHashes",
    "note",
    "ips",
    "testActivity",
    "suspicious",
    "clientProfiles",
  ]);
}
export async function getUser(
  context: ServiceContext,
  input: OperationInput<ClientQuery>,
): Promise<GetUserResponse> {
  const { uid } = context.actor;

  // Social sign-in creates the authentication account before username/captcha
  // onboarding creates its application profile. Preserve the session on 404.
  const userInfo = await UserDAL.getUser(uid, "get user", input.query?.client);

  userInfo.personalBests ??= {
    time: {},
    words: {},
    quote: {},
    zen: {},
    custom: {},
  };

  const agentLog = buildAgentLog(context.client);
  context.background(
    Promise.all([
      addLog("user_data_requested", agentLog, uid),
      UserDAL.logIpAddress(uid, agentLog.ip, userInfo),
    ]),
  );

  let inboxUnreadSize = 0;
  if (context.configuration.users.inbox.enabled) {
    inboxUnreadSize = userInfo.inbox?.filter((mail) => !mail.read).length ?? 0;
  }

  if (!userInfo.name) {
    userInfo.needsToChangeName = true;
    await UserDAL.flagForNameChange(uid);
  }

  const isPremium = await UserDAL.checkIfUserIsPremium(uid, userInfo);

  const allTimeLbs = await getAllTimeLbs(uid, input.query?.client);
  const testActivity = generateCurrentTestActivity(userInfo.testActivity);
  const relevantUserInfo = getRelevantUserInfo(userInfo);

  const resultFilterPresets: ResultFilters[] =
    relevantUserInfo.resultFilterPresets ?? [];
  delete relevantUserInfo.resultFilterPresets;

  const tags = relevantUserInfo.tags ?? [];
  delete relevantUserInfo.tags;

  const customThemes = relevantUserInfo.customThemes ?? [];
  delete relevantUserInfo.customThemes;

  const userData: User = {
    ...relevantUserInfo,
    resultFilterPresets,
    tags,
    customThemes,
    isPremium,
    allTimeLbs,
    testActivity,
  };

  return new MonkeyResponse("User data retrieved", {
    ...userData,
    inboxUnreadSize: inboxUnreadSize,
  });
}
export async function getPersonalBests(
  context: ServiceContext,
  input: OperationInput<GetPersonalBestsQuery>,
): Promise<GetPersonalBestsResponse> {
  const { uid } = context.actor;
  const { mode, mode2 } = input.query;

  const data =
    (await UserDAL.getPersonalBests(uid, mode, mode2, input.query.client)) ??
    null;
  return new MonkeyResponse("Personal bests retrieved", data);
}
export async function getStats(
  context: ServiceContext,
  input: OperationInput<ClientQuery>,
): Promise<GetStatsResponse> {
  const { uid } = context.actor;

  const data = (await UserDAL.getStats(uid, input.query?.client)) ?? null;
  return new MonkeyResponse("Personal stats retrieved", data);
}
