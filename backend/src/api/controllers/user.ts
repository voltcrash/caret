import { verifyCaptcha } from "./user/captcha";
import type { Client, ClientQuery } from "@oxytype/schemas/shared";
import { atomicUser } from "../../db/mutation";
import * as UserDAL from "../../dal/user";
import MonkeyError from "../../utils/error";
import { MonkeyResponse } from "../../utils/monkey-response";
import { buildAgentLog, omit, sanitizeString } from "../../utils/misc";
import * as LeaderboardsDAL from "../../dal/leaderboards";
import { purgeUserFromDailyLeaderboards } from "../../utils/daily-leaderboards";
import { purgeUserFromXpLeaderboards } from "../../services/weekly-xp-leaderboard";
import { deleteUserAccount } from "../../services/user-deletion";
import { randomUUID } from "node:crypto";
import { newId } from "../../utils/id";
import * as ReportDAL from "../../dal/report";
import * as AuthUtil from "../../utils/auth";
import * as Dates from "date-fns";
import { UTCDateMini } from "@date-fns/utc";
import * as BlocklistDal from "../../dal/blocklist";
import {
  AllTimeLbs,
  ResultFilters,
  User,
  UserProfile,
  CountByYearAndDay,
  TestActivity,
  UserProfileDetails,
} from "@oxytype/schemas/users";
import { addImportantLog, addLog } from "../../dal/logs";
import {
  AddCustomThemeRequest,
  AddCustomThemeResponse,
  AddFavoriteQuoteRequest,
  AddResultFilterPresetRequest,
  AddResultFilterPresetResponse,
  AddTagRequest,
  AddTagResponse,
  CheckNamePathParameters,
  CheckNameResponse,
  CreateUserRequest,
  DeleteCustomThemeRequest,
  EditCustomThemeRequst,
  EditTagRequest,
  GetCurrentTestActivityResponse,
  GetCustomThemesResponse,
  GetFavoriteQuotesResponse,
  GetPersonalBestsQuery,
  GetPersonalBestsResponse,
  GetProfilePathParams,
  GetProfileQuery,
  GetProfileResponse,
  GetStatsResponse,
  GetStreakResponse,
  GetTagsResponse,
  GetTestActivityResponse,
  GetUserInboxResponse,
  GetUserResponse,
  RemoveFavoriteQuoteRequest,
  RemoveResultFilterPresetPathParams,
  ReportUserRequest,
  SetStreakHourOffsetRequest,
  TagIdPathParams,
  UpdateLeaderboardMemoryRequest,
  UpdateUserInboxRequest,
  UpdateUserNameRequest,
  UpdateUserProfileRequest,
  UpdateUserProfileResponse,
} from "@oxytype/contracts/users";
import { MILLISECONDS_IN_DAY } from "@oxytype/util/date-and-time";
import { MonkeyRequest } from "../types";
import { PersonalBest } from "@oxytype/schemas/shared";

export async function createNewUser(
  req: MonkeyRequest<undefined, CreateUserRequest>,
): Promise<MonkeyResponse> {
  const { name, captcha } = req.body;
  const { email, uid } = req.ctx.decodedToken;

  const existingUser = await UserDAL.exists(uid);
  if (existingUser) throw new MonkeyError(409, "Account already registered");

  // Expired challenges and verification outages can be retried in this session.
  await verifyCaptcha(captcha, "signup");

  // Profile conflicts must preserve the authenticated onboarding session.
  if (email.endsWith("@tidal.lol") || email.endsWith("@selfbot.cc")) {
    throw new MonkeyError(400, "Invalid domain");
  }

  const available = await UserDAL.isNameAvailable(name, uid);
  if (!available) {
    throw new MonkeyError(409, "Username unavailable");
  }

  const blocklisted = await BlocklistDal.contains({ name, email });
  if (blocklisted) {
    throw new MonkeyError(409, "Username or email blocked");
  }

  await UserDAL.addUser(name, email, uid);
  void addImportantLog("user_created", `${name} ${email}`, uid);

  return new MonkeyResponse("User created", null);
}

export async function deleteUser(req: MonkeyRequest): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  const userInfo = await deleteUserAccount(uid, req.ctx.configuration);

  void addImportantLog(
    "user_deleted",
    `${userInfo?.email} ${userInfo?.name}`,
    uid,
  );

  return new MonkeyResponse("User deleted", null);
}

export async function resetUser(req: MonkeyRequest): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  const userInfo = await atomicUser(uid, async () => {
    const user = await UserDAL.getPartialUser(uid, "reset user", [
      "banned",
      "email",
      "name",
    ]);
    if (user.banned) {
      throw new MonkeyError(403, "Banned users cannot reset their account");
    }
    await UserDAL.resetUser(uid);
    return user;
  });
  void addImportantLog("user_reset", `${userInfo.email} ${userInfo.name}`, uid);

  return new MonkeyResponse("User reset", null);
}

export async function updateName(
  req: MonkeyRequest<undefined, UpdateUserNameRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { name } = req.body;

  const blocklisted = await BlocklistDal.contains({ name });
  if (blocklisted) {
    throw new MonkeyError(409, "Username blocked");
  }

  const user = await UserDAL.getPartialUser(uid, "update name", [
    "name",
    "banned",
    "needsToChangeName",
    "lastNameChange",
  ]);

  if (user.banned) {
    throw new MonkeyError(403, "Banned users cannot change their name");
  }

  if (
    !user?.needsToChangeName &&
    Date.now() - (user.lastNameChange ?? 0) < MILLISECONDS_IN_DAY * 30
  ) {
    throw new MonkeyError(409, "You can change your name once every 30 days");
  }

  await UserDAL.updateName(uid, name, user.name);

  void addImportantLog(
    "user_name_updated",
    `changed name from ${user.name} to ${name}`,
    uid,
  );

  return new MonkeyResponse("User's name updated", null);
}

export async function clearPb(
  req: MonkeyRequest<ClientQuery>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  await UserDAL.clearPb(uid, req.query?.client);
  await purgeUserFromDailyLeaderboards(
    uid,
    req.ctx.configuration.dailyLeaderboards,
    req.query?.client ?? "web",
  );
  void addImportantLog("user_cleared_pbs", "", uid);

  return new MonkeyResponse("User's PB cleared", null);
}

export async function optOutOfLeaderboards(
  req: MonkeyRequest,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  await UserDAL.optOutOfLeaderboards(uid);
  await purgeUserFromDailyLeaderboards(
    uid,
    req.ctx.configuration.dailyLeaderboards,
  );
  await purgeUserFromXpLeaderboards(
    uid,
    req.ctx.configuration.leaderboards.weeklyXp,
  );
  void addImportantLog("user_opted_out_of_leaderboards", "", uid);

  return new MonkeyResponse("User opted out of leaderboards", null);
}

export async function checkName(
  req: MonkeyRequest<undefined, undefined, CheckNamePathParameters>,
): Promise<CheckNameResponse> {
  const { name } = req.params;
  const { uid } = req.ctx.decodedToken;

  const available = await UserDAL.isNameAvailable(name, uid);

  return new MonkeyResponse("Check username", {
    available,
  });
}

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

export async function addResultFilterPreset(
  req: MonkeyRequest<undefined, AddResultFilterPresetRequest>,
): Promise<AddResultFilterPresetResponse> {
  const { uid } = req.ctx.decodedToken;
  const filter = req.body;
  const { maxPresetsPerUser } = req.ctx.configuration.results.filterPresets;

  const createdId = await UserDAL.addResultFilterPreset(
    uid,
    filter,
    maxPresetsPerUser,
  );
  return new MonkeyResponse("Result filter preset created", createdId);
}

export async function removeResultFilterPreset(
  req: MonkeyRequest<undefined, undefined, RemoveResultFilterPresetPathParams>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { presetId } = req.params;

  await UserDAL.removeResultFilterPreset(uid, presetId);
  return new MonkeyResponse("Result filter preset deleted", null);
}

export async function addTag(
  req: MonkeyRequest<undefined, AddTagRequest>,
): Promise<AddTagResponse> {
  const { uid } = req.ctx.decodedToken;
  const { tagName } = req.body;

  const tag = await UserDAL.addTag(uid, tagName);
  return new MonkeyResponse("Tag updated", tag);
}

export async function clearTagPb(
  req: MonkeyRequest<ClientQuery, undefined, TagIdPathParams>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { tagId } = req.params;

  await UserDAL.removeTagPb(uid, tagId, req.query?.client);
  return new MonkeyResponse("Tag PB cleared", null);
}

export async function editTag(
  req: MonkeyRequest<undefined, EditTagRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { tagId, newName } = req.body;

  await UserDAL.editTag(uid, tagId, newName);
  return new MonkeyResponse("Tag updated", null);
}

export async function removeTag(
  req: MonkeyRequest<undefined, undefined, TagIdPathParams>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { tagId } = req.params;

  await UserDAL.removeTag(uid, tagId);
  return new MonkeyResponse("Tag deleted", null);
}

export async function getTags(
  req: MonkeyRequest<ClientQuery>,
): Promise<GetTagsResponse> {
  const { uid } = req.ctx.decodedToken;

  const tags = await UserDAL.getTags(uid, req.query?.client);
  return new MonkeyResponse("Tags retrieved", tags);
}

export async function updateLbMemory(
  req: MonkeyRequest<ClientQuery, UpdateLeaderboardMemoryRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { mode, language, rank } = req.body;
  const mode2 = req.body.mode2;

  await UserDAL.updateLbMemory(
    uid,
    mode,
    mode2,
    language,
    rank,
    req.query?.client,
  );
  return new MonkeyResponse("Leaderboard memory updated", null);
}

export async function getCustomThemes(
  req: MonkeyRequest,
): Promise<GetCustomThemesResponse> {
  const { uid } = req.ctx.decodedToken;
  const customThemes = await UserDAL.getThemes(uid);
  return new MonkeyResponse("Custom themes retrieved", customThemes);
}

export async function addCustomTheme(
  req: MonkeyRequest<undefined, AddCustomThemeRequest>,
): Promise<AddCustomThemeResponse> {
  const { uid } = req.ctx.decodedToken;
  const { name, colors } = req.body;

  const addedTheme = await UserDAL.addTheme(uid, { name, colors });
  return new MonkeyResponse("Custom theme added", addedTheme);
}

export async function removeCustomTheme(
  req: MonkeyRequest<undefined, DeleteCustomThemeRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { themeId } = req.body;
  await UserDAL.removeTheme(uid, themeId);
  return new MonkeyResponse("Custom theme removed", null);
}

export async function editCustomTheme(
  req: MonkeyRequest<undefined, EditCustomThemeRequst>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { themeId, theme } = req.body;

  await UserDAL.editTheme(uid, themeId, theme);
  return new MonkeyResponse("Custom theme updated", null);
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

export async function getFavoriteQuotes(
  req: MonkeyRequest,
): Promise<GetFavoriteQuotesResponse> {
  const { uid } = req.ctx.decodedToken;

  const quotes = await UserDAL.getFavoriteQuotes(uid);

  return new MonkeyResponse("Favorite quotes retrieved", quotes);
}

export async function addFavoriteQuote(
  req: MonkeyRequest<undefined, AddFavoriteQuoteRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  const { language, quoteId } = req.body;

  await UserDAL.addFavoriteQuote(
    uid,
    language,
    quoteId,
    req.ctx.configuration.quotes.maxFavorites,
  );

  return new MonkeyResponse("Quote added to favorites", null);
}

export async function removeFavoriteQuote(
  req: MonkeyRequest<undefined, RemoveFavoriteQuoteRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;

  const { quoteId, language } = req.body;
  await UserDAL.removeFavoriteQuote(uid, language, quoteId);

  return new MonkeyResponse("Quote removed from favorites", null);
}

export async function getProfile(
  req: MonkeyRequest<GetProfileQuery, undefined, GetProfilePathParams>,
): Promise<GetProfileResponse> {
  const { uidOrName } = req.params;

  const user = req.query.isUid
    ? await UserDAL.getUser(uidOrName, "get user profile", req.query.client)
    : await UserDAL.getUserByName(
        uidOrName,
        "get user profile",
        req.query.client,
      );

  const {
    name,
    banned,
    inventory,
    profileDetails,
    personalBests,
    completedTests,
    startedTests,
    timeTyping,
    addedAt,
    xp,
    streak,
    lbOptOut,
  } = user;

  const extractValid = (
    src: Record<string, PersonalBest[]>,
    validKeys: string[],
  ): Record<string, PersonalBest[]> => {
    return validKeys.reduce((obj, key) => {
      if (src?.[key] !== undefined) {
        obj[key] = src[key];
      }
      return obj;
    }, {});
  };

  const validTimePbs = extractValid(personalBests.time, [
    "15",
    "30",
    "60",
    "120",
  ]);
  const validWordsPbs = extractValid(personalBests.words, [
    "10",
    "25",
    "50",
    "100",
  ]);

  const typingStats = {
    completedTests,
    startedTests,
    timeTyping,
  };

  const relevantPersonalBests = {
    time: validTimePbs,
    words: validWordsPbs,
  };

  const baseProfile = {
    name,
    banned,
    addedAt,
    typingStats,
    personalBests: relevantPersonalBests,
    xp,
    streak: streak?.length ?? 0,
    maxStreak: streak?.maxLength ?? 0,
    lbOptOut,
    isPremium: await UserDAL.checkIfUserIsPremium(user.uid, user),
  };

  if (banned) {
    return new MonkeyResponse("Profile retrived: banned user", baseProfile);
  }

  const allTimeLbs = await getAllTimeLbs(user.uid, req.query.client);

  const profileData = {
    ...baseProfile,
    inventory,
    details: profileDetails,
    allTimeLbs,
    uid: user.uid,
  } as UserProfile;

  if (user.profileDetails?.showActivityOnPublicProfile) {
    profileData.testActivity = generateCurrentTestActivity(user.testActivity);
  } else {
    delete profileData.testActivity;
  }
  return new MonkeyResponse("Profile retrieved", profileData);
}

export async function updateProfile(
  req: MonkeyRequest<undefined, UpdateUserProfileRequest>,
): Promise<UpdateUserProfileResponse> {
  const { uid } = req.ctx.decodedToken;
  const {
    bio,
    keyboard,
    socialProfiles,
    selectedBadgeId,
    showActivityOnPublicProfile,
  } = req.body;

  const user = await UserDAL.getPartialUser(uid, "update user profile", [
    "banned",
    "inventory",
  ]);

  if (user.banned) {
    throw new MonkeyError(403, "Banned users cannot update their profile");
  }

  user.inventory?.badges.forEach((badge) => {
    if (badge.id === selectedBadgeId) {
      badge.selected = true;
    } else {
      delete badge.selected;
    }
  });

  const profileDetailsUpdates: Partial<UserProfileDetails> = {
    bio: sanitizeString(bio),
    keyboard: sanitizeString(keyboard),
    socialProfiles: Object.fromEntries(
      Object.entries(socialProfiles ?? {}).map(([key, value]) => [
        key,
        sanitizeString(value),
      ]),
    ),
    showActivityOnPublicProfile,
  };

  await UserDAL.updateProfile(uid, profileDetailsUpdates, user.inventory);

  return new MonkeyResponse("Profile updated", profileDetailsUpdates);
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

export async function revokeAllTokens(
  req: MonkeyRequest,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  await AuthUtil.revokeTokensByUid(uid);
  void addImportantLog("user_tokens_revoked", "", uid);
  return new MonkeyResponse("All tokens revoked", null);
}

async function getAllTimeLbs(
  uid: string,
  client: Client = "web",
): Promise<AllTimeLbs> {
  const allTime15English = await LeaderboardsDAL.getRank(
    "time",
    "15",
    "english",
    uid,
    client,
  );

  const allTime15EnglishCount = await LeaderboardsDAL.getCount(
    "time",
    "15",
    "english",
    client,
  );

  const allTime60English = await LeaderboardsDAL.getRank(
    "time",
    "60",
    "english",
    uid,
    client,
  );

  const allTime60EnglishCount = await LeaderboardsDAL.getCount(
    "time",
    "60",
    "english",
    client,
  );

  const english15 =
    allTime15English === null
      ? undefined
      : {
          rank: allTime15English.rank,
          count: allTime15EnglishCount,
        };

  const english60 =
    allTime60English === null
      ? undefined
      : {
          rank: allTime60English.rank,
          count: allTime60EnglishCount,
        };

  return {
    time: {
      "15": {
        english: english15,
      },
      "60": {
        english: english60,
      },
    },
  };
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
