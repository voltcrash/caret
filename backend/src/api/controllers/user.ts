import { generateCurrentTestActivity } from "./user/activity";
import { getAllTimeLbs } from "./user/leaderboards";
import { verifyCaptcha } from "./user/captcha";
import type { ClientQuery } from "@oxytype/schemas/shared";
import * as UserDAL from "../../dal/user";
import { MonkeyResponse } from "../../utils/monkey-response";
import { buildAgentLog, omit } from "../../utils/misc";
import { randomUUID } from "node:crypto";
import { newId } from "../../utils/id";
import * as ReportDAL from "../../dal/report";
import { ResultFilters, User } from "@oxytype/schemas/users";
import { addLog } from "../../dal/logs";
import {
  GetPersonalBestsQuery,
  GetPersonalBestsResponse,
  GetStatsResponse,
  GetUserInboxResponse,
  GetUserResponse,
  ReportUserRequest,
  UpdateUserInboxRequest,
} from "@oxytype/contracts/users";
import { MonkeyRequest } from "../types";

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
  req: MonkeyRequest<ClientQuery>,
): Promise<GetUserResponse> {
  const { uid } = req.ctx.decodedToken;

  // Social sign-in creates the authentication account before username/captcha
  // onboarding creates its application profile. Preserve the session on 404.
  const userInfo = await UserDAL.getUser(uid, "get user", req.query?.client);

  userInfo.personalBests ??= {
    time: {},
    words: {},
    quote: {},
    zen: {},
    custom: {},
  };

  const agentLog = buildAgentLog(req);
  void addLog("user_data_requested", agentLog, uid);
  void UserDAL.logIpAddress(uid, agentLog.ip, userInfo);

  let inboxUnreadSize = 0;
  if (req.ctx.configuration.users.inbox.enabled) {
    inboxUnreadSize = userInfo.inbox?.filter((mail) => !mail.read).length ?? 0;
  }

  if (!userInfo.name) {
    userInfo.needsToChangeName = true;
    await UserDAL.flagForNameChange(uid);
  }

  const isPremium = await UserDAL.checkIfUserIsPremium(uid, userInfo);

  const allTimeLbs = await getAllTimeLbs(uid, req.query?.client);
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
  req: MonkeyRequest<GetPersonalBestsQuery>,
): Promise<GetPersonalBestsResponse> {
  const { uid } = req.ctx.decodedToken;
  const { mode, mode2 } = req.query;

  const data =
    (await UserDAL.getPersonalBests(uid, mode, mode2, req.query.client)) ??
    null;
  return new MonkeyResponse("Personal bests retrieved", data);
}

export async function getStats(
  req: MonkeyRequest<ClientQuery>,
): Promise<GetStatsResponse> {
  const { uid } = req.ctx.decodedToken;

  const data = (await UserDAL.getStats(uid, req.query?.client)) ?? null;
  return new MonkeyResponse("Personal stats retrieved", data);
}

export async function getInbox(
  req: MonkeyRequest,
): Promise<GetUserInboxResponse> {
  const { uid } = req.ctx.decodedToken;

  const inbox = await UserDAL.getInbox(uid);

  return new MonkeyResponse("Inbox retrieved", {
    inbox,
    maxMail: req.ctx.configuration.users.inbox.maxMail,
  });
}

export async function updateInbox(
  req: MonkeyRequest<undefined, UpdateUserInboxRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { mailIdsToMarkRead, mailIdsToDelete } = req.body;

  await UserDAL.updateInbox(
    uid,
    mailIdsToMarkRead ?? [],
    mailIdsToDelete ?? [],
  );

  return new MonkeyResponse("Inbox updated", null);
}

export async function reportUser(
  req: MonkeyRequest<undefined, ReportUserRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const {
    reporting: { maxReports, contentReportLimit },
  } = req.ctx.configuration.quotes;

  const { uid: uidToReport, reason, comment, captcha } = req.body;

  await verifyCaptcha(captcha, "user-report");

  const newReport: ReportDAL.DBReport = {
    _id: newId(),
    id: randomUUID(),
    type: "user",
    timestamp: new Date().getTime(),
    uid,
    contentId: `${uidToReport}`,
    reason,
    comment: comment ?? "",
  };

  await ReportDAL.createReport(newReport, maxReports, contentReportLimit);

  return new MonkeyResponse("User reported", null);
}

export {
  setStreakHourOffset,
  generateCurrentTestActivity,
  getTestActivity,
  getCurrentTestActivity,
  getStreak,
} from "./user/activity";

export {
  clearPb,
  optOutOfLeaderboards,
  updateLbMemory,
} from "./user/leaderboards";

export {
  createNewUser,
  deleteUser,
  resetUser,
  updateName,
  checkName,
  revokeAllTokens,
} from "./user/account";

export {
  addResultFilterPreset,
  removeResultFilterPreset,
} from "./user/presets";

export { addTag, clearTagPb, editTag, removeTag, getTags } from "./user/tags";

export {
  getCustomThemes,
  addCustomTheme,
  removeCustomTheme,
  editCustomTheme,
} from "./user/themes";

export {
  getFavoriteQuotes,
  addFavoriteQuote,
  removeFavoriteQuote,
} from "./user/favorite-quotes";

export { getProfile, updateProfile } from "./user/profile";
