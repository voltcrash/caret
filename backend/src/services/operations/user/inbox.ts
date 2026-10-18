import * as UserDAL from "../../../dal/user";
import { MonkeyResponse } from "../../../utils/monkey-response";
import {
  GetUserInboxResponse,
  UpdateUserInboxRequest,
} from "@oxytype/contracts/users";
import type { ServiceContext, OperationInput } from "../../context";

export async function getInbox(
  context: ServiceContext,
  _input: OperationInput,
): Promise<GetUserInboxResponse> {
  const { uid } = context.actor;

  const inbox = await UserDAL.getInbox(uid);

  return new MonkeyResponse("Inbox retrieved", {
    inbox,
    maxMail: context.configuration.users.inbox.maxMail,
  });
}
export async function updateInbox(
  context: ServiceContext,
  input: OperationInput<undefined, UpdateUserInboxRequest>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const { mailIdsToMarkRead, mailIdsToDelete } = input.body;

  await UserDAL.updateInbox(
    uid,
    mailIdsToMarkRead ?? [],
    mailIdsToDelete ?? [],
  );

  return new MonkeyResponse("Inbox updated", null);
}
