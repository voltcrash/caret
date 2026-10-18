import { verifyCaptcha } from "./captcha";
import { atomicUser } from "../../../db/mutation";
import * as UserDAL from "../../../dal/user";
import MonkeyError from "../../../utils/error";
import { MonkeyResponse } from "../../../utils/monkey-response";
import { deleteUserAccount } from "../../../services/user-deletion";
import * as AuthUtil from "../../../utils/auth";
import * as BlocklistDal from "../../../dal/blocklist";
import { addImportantLog } from "../../../dal/logs";
import {
  CheckNamePathParameters,
  CheckNameResponse,
  CreateUserRequest,
  UpdateUserNameRequest,
} from "@oxytype/contracts/users";
import { MILLISECONDS_IN_DAY } from "@oxytype/util/date-and-time";
import type { ServiceContext, OperationInput } from "../../context";

export async function createNewUser(
  context: ServiceContext,
  input: OperationInput<undefined, CreateUserRequest>,
): Promise<MonkeyResponse> {
  const { name, captcha } = input.body;
  const { email, uid } = context.actor;

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
export async function deleteUser(
  context: ServiceContext,
  _input: OperationInput,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;

  const userInfo = await deleteUserAccount(uid, context.configuration);

  void addImportantLog(
    "user_deleted",
    `${userInfo?.email} ${userInfo?.name}`,
    uid,
  );

  return new MonkeyResponse("User deleted", null);
}
export async function resetUser(
  context: ServiceContext,
  _input: OperationInput,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;

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
  context: ServiceContext,
  input: OperationInput<undefined, UpdateUserNameRequest>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const { name } = input.body;

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
export async function checkName(
  context: ServiceContext,
  input: OperationInput<undefined, undefined, CheckNamePathParameters>,
): Promise<CheckNameResponse> {
  const { name } = input.params;
  const { uid } = context.actor;

  const available = await UserDAL.isNameAvailable(name, uid);

  return new MonkeyResponse("Check username", {
    available,
  });
}
export async function revokeAllTokens(
  context: ServiceContext,
  _input: OperationInput,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  await AuthUtil.revokeTokensByUid(uid);
  void addImportantLog("user_tokens_revoked", "", uid);
  return new MonkeyResponse("All tokens revoked", null);
}
