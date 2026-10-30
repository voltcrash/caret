import { eq, sql } from "drizzle-orm";

import MonkeyError from "../../utils/error";

import { database } from "../../db/client";
import { currentUserDraft, readUser } from "../../db/mutation";
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
  _client: Client = "web",
): Promise<Pick<DBUser, K>> {
  let user: Partial<DBUser> | undefined = currentUserDraft(uid);
  if (user === undefined) {
    // Project only requested keys before crossing Hyperdrive; profiles include
    // potentially large PBs, activity histories and custom themes.
    const data =
      fields.length === 0
        ? sql<Partial<DBUser>>`'{}'::jsonb`
        : sql<
            Partial<DBUser>
          >`(SELECT coalesce(jsonb_object_agg(field, ${users.data}->field), '{}'::jsonb)
          FROM (VALUES ${sql.join(
            fields.map((field) => sql`(${field}::text)`),
            sql`, `,
          )}) AS requested(field)
          WHERE ${users.data}->field IS NOT NULL)`;
    user = (
      await database()
        .select({ data })
        .from(users)
        .where(eq(users.uid, uid))
        .limit(1)
    )[0]?.data;
  }
  if (user === undefined) throw new MonkeyError(404, "User not found", stack);
  return Object.fromEntries(
    fields
      .filter((key) => key === "personalBests" || user[key] !== undefined)
      .map((key) => [
        key,
        structuredClone(
          key === "personalBests" ? (user[key] ?? emptyPb()) : user[key],
        ),
      ]),
  ) as Pick<DBUser, K>;
}
export async function findByName(name: string): Promise<DBUser | undefined> {
  const row = (
    await database()
      .select({ uid: users.uid, data: users.data })
      .from(users)
      .where(eq(users.nameKey, name.toLowerCase()))
      .limit(1)
  )[0];
  if (row === undefined) return undefined;
  const draft = currentUserDraft(row.uid);
  return draft === undefined ? row.data : structuredClone(draft);
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
