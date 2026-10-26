import MonkeyError from "../../utils/error";
import { newId } from "../../utils/id";

import { mutateUser } from "../../db/mutation";

import type { Client } from "@caret/schemas/shared";

import type { DBUser, DBUserTag } from "./types";
import { emptyPb } from "./empty-pb";
import { getUser } from "./queries";

export async function addTag(uid: string, name: string): Promise<DBUserTag> {
  const tag = { _id: newId(), name, personalBests: emptyPb() };
  await mutateUser(uid, (user) => {
    if ((user.tags?.length ?? 0) >= 15) {
      throw new MonkeyError(400, "Maximum number of tags reached");
    }
    (user.tags ??= []).push(tag);
  });
  return tag;
}
export async function getTags(
  uid: string,
  _client: Client = "web",
): Promise<DBUserTag[]> {
  const user = await getUser(uid, "get tags");
  return user.tags ?? [];
}
function tagById(user: DBUser, id: string): DBUserTag {
  const tag = user.tags?.find((item) => item._id === id);
  if (!tag) throw new MonkeyError(404, "Tag not found");
  return tag;
}
export async function editTag(
  uid: string,
  id: string,
  name: string,
): Promise<void> {
  await mutateUser(uid, (user) => {
    tagById(user, id).name = name;
  });
}
export async function removeTag(uid: string, id: string): Promise<void> {
  await mutateUser(uid, (user) => {
    tagById(user, id);
    user.tags = user.tags?.filter((item) => item._id !== id);
  });
}
export async function removeTagPb(
  uid: string,
  id: string,
  _client: Client = "web",
): Promise<void> {
  await mutateUser(uid, (user) => {
    const tag = tagById(user, id);
    tag.personalBests = emptyPb();
  });
}
