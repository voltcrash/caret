import { eq } from "drizzle-orm";

import MonkeyError from "../../utils/error";

import { database } from "../../db/client";
import { readUser } from "../../db/mutation";
import { users } from "../../db/schema";

import type { Client } from "@caret/schemas/shared";

import type { DBUser } from "./types";
import { emptyPb } from "./empty-pb";
export async function getUser(
  uid: string,
  stack: string,
  _client: Client = "web",
): Promise<DBUser> {
  const user = await readUser(uid);
  if (!user) throw new MonkeyError(404, "User not found", stack);
  user.personalBests ??= emptyPb();
  return user;
}
export async function getPartialUser<K extends keyof DBUser>(
  uid: string,
  stack: string,
  fields: K[],
  client: Client = "web",
): Promise<Pick<DBUser, K>> {
  const user = await getUser(uid, stack, client);
  return Object.fromEntries(
    fields
      .filter((key) => user[key] !== undefined)
      .map((key) => [key, user[key]]),
  ) as Pick<DBUser, K>;
}
export async function findByName(name: string): Promise<DBUser | undefined> {
  const row = (
    await database()
      .select()
      .from(users)
      .where(eq(users.nameKey, name.toLowerCase()))
      .limit(1)
  )[0];
  return row ? await readUser(row.uid) : undefined;
}
export async function isNameAvailable(
  name: string,
  uid: string,
): Promise<boolean> {
  const user = await findByName(name);
  return !user || user.uid === uid;
}
export async function getUserByName(
  name: string,
  stack: string,
  _client: Client = "web",
): Promise<DBUser> {
  const user = await findByName(name);
  if (!user) throw new MonkeyError(404, "User not found", stack);
  return user;
}
