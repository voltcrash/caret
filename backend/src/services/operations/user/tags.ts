import type { ClientQuery } from "@caret/schemas/shared";
import * as UserDAL from "../../../dal/user";
import { ApiResponse } from "../../../utils/api-response";
import {
  AddTagRequest,
  AddTagResponse,
  EditTagRequest,
  GetTagsResponse,
  TagIdPathParams,
} from "@caret/contracts/users";
import type { ServiceContext, OperationInput } from "../../context";

export async function addTag(
  context: ServiceContext,
  input: OperationInput<undefined, AddTagRequest>,
): Promise<AddTagResponse> {
  const { uid } = context.actor;
  const { tagName } = input.body;

  const tag = await UserDAL.addTag(uid, tagName);
  return new ApiResponse("Tag updated", tag);
}
export async function clearTagPb(
  context: ServiceContext,
  input: OperationInput<ClientQuery, undefined, TagIdPathParams>,
): Promise<ApiResponse> {
  const { uid } = context.actor;
  const { tagId } = input.params;

  await UserDAL.removeTagPb(uid, tagId, input.query?.client);
  return new ApiResponse("Tag PB cleared", null);
}
export async function editTag(
  context: ServiceContext,
  input: OperationInput<undefined, EditTagRequest>,
): Promise<ApiResponse> {
  const { uid } = context.actor;
  const { tagId, newName } = input.body;

  await UserDAL.editTag(uid, tagId, newName);
  return new ApiResponse("Tag updated", null);
}
export async function removeTag(
  context: ServiceContext,
  input: OperationInput<undefined, undefined, TagIdPathParams>,
): Promise<ApiResponse> {
  const { uid } = context.actor;
  const { tagId } = input.params;

  await UserDAL.removeTag(uid, tagId);
  return new ApiResponse("Tag deleted", null);
}
export async function getTags(
  context: ServiceContext,
  input: OperationInput<ClientQuery>,
): Promise<GetTagsResponse> {
  const { uid } = context.actor;

  const tags = await UserDAL.getTags(uid, input.query?.client);
  return new ApiResponse("Tags retrieved", tags);
}
