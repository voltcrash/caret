import { generateCurrentTestActivity } from "./activity";
import { getAllTimeLbs } from "./leaderboards";
import * as UserDAL from "../../../dal/user";
import MonkeyError from "../../../utils/error";
import { MonkeyResponse } from "../../../utils/monkey-response";
import { sanitizeString } from "../../../utils/misc";
import { UserProfile, UserProfileDetails } from "@oxytype/schemas/users";
import {
  GetProfilePathParams,
  GetProfileQuery,
  GetProfileResponse,
  UpdateUserProfileRequest,
  UpdateUserProfileResponse,
} from "@oxytype/contracts/users";
import type { ServiceContext, OperationInput } from "../../context";
import { PersonalBest } from "@oxytype/schemas/shared";

export async function getProfile(
  _context: ServiceContext,
  input: OperationInput<GetProfileQuery, undefined, GetProfilePathParams>,
): Promise<GetProfileResponse> {
  const { uidOrName } = input.params;

  const user = input.query.isUid
    ? await UserDAL.getUser(uidOrName, "get user profile", input.query.client)
    : await UserDAL.getUserByName(
        uidOrName,
        "get user profile",
        input.query.client,
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

  const allTimeLbs = await getAllTimeLbs(user.uid, input.query.client);

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
  context: ServiceContext,
  input: OperationInput<undefined, UpdateUserProfileRequest>,
): Promise<UpdateUserProfileResponse> {
  const { uid } = context.actor;
  const {
    bio,
    keyboard,
    socialProfiles,
    selectedBadgeId,
    showActivityOnPublicProfile,
  } = input.body;

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
