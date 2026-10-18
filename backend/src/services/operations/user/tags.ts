import type { ClientQuery } from "@oxytype/schemas/shared";
import * as UserDAL from "../../../dal/user";
import { MonkeyResponse } from "../../../utils/monkey-response";
import {
  AddTagRequest,
  AddTagResponse,
  EditTagRequest,
  GetTagsResponse,
  TagIdPathParams,
} from "@oxytype/contracts/users";
import type { ServiceContext, OperationInput } from "../../context";

export async function addTag(
  context: ServiceContext,
  input: OperationInput<undefined, AddTagRequest>,
): Promise<AddTagResponse> {
  const { uid } = context.actor;
  const { tagName } = input.body;

  const tag = await UserDAL.addTag(uid, tagName);
  return new MonkeyResponse("Tag updated", tag);
}
export async function clearTagPb(
  context: ServiceContext,
  input: OperationInput<ClientQuery, undefined, TagIdPathParams>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const { tagId } = input.params;

  await UserDAL.removeTagPb(uid, tagId, input.query?.client);
  return new MonkeyResponse("Tag PB cleared", null);
}
export async function editTag(
  context: ServiceContext,
  input: OperationInput<undefined, EditTagRequest>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const { tagId, newName } = input.body;

  await UserDAL.editTag(uid, tagId, newName);
  return new MonkeyResponse("Tag updated", null);
}
export async function removeTag(
  context: ServiceContext,
  input: OperationInput<undefined, undefined, TagIdPathParams>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const { tagId } = input.params;

  await UserDAL.removeTag(uid, tagId);
  return new MonkeyResponse("Tag deleted", null);
}
export async function getTags(
  context: ServiceContext,
  input: OperationInput<ClientQuery>,
): Promise<GetTagsResponse> {
  const { uid } = context.actor;

  const tags = await UserDAL.getTags(uid, input.query?.client);
  return new MonkeyResponse("Tags retrieved", tags);
}
