import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
import type { D1PreparedStatement } from "@cloudflare/workers-types";
import { users } from "./schema";
import {
  binding,
  database,
  primaryDatabase,
  encode,
  statement,
} from "./client";
import { newId } from "../utils/id";
import MonkeyError from "../utils/error";
import type { DBUser } from "../dal/user";

type Draft = { uid: string; user: DBUser; statements: D1PreparedStatement[] };
const drafts = new AsyncLocalStorage<Draft>();

export function currentUserDraft(uid: string): DBUser | undefined {
  const draft = drafts.getStore();
  return draft?.uid === uid ? draft.user : undefined;
}

export async function readUser(uid: string): Promise<DBUser | undefined> {
  const draft = currentUserDraft(uid);
  if (draft) return structuredClone(draft);
  const row = await database()
    .select()
    .from(users)
    .where(eq(users.uid, uid))
    .get();
  return row?.data;
}

/** Enlist a write in the current user's atomic batch, or execute it directly. */
export async function stage(query: D1PreparedStatement): Promise<void> {
  const draft = drafts.getStore();
  if (draft) draft.statements.push(query);
  else await query.run();
}

function userStatement(user: DBUser, version: number): D1PreparedStatement {
  return statement(
    `UPDATE users SET name=?,name_key=?,email=?,xp=?,time_typing=?,completed_tests=?,started_tests=?,banned=?,lb_opt_out=?,needs_to_change_name=?,data=?,version=version+1 WHERE uid=? AND version=?`,
    user.name,
    user.name.toLowerCase(),
    user.email,
    user.xp ?? 0,
    user.timeTyping ?? 0,
    user.completedTests ?? 0,
    user.startedTests ?? 0,
    Number(user.banned ?? false),
    Number(user.lbOptOut ?? false),
    Number(user.needsToChangeName ?? false),
    encode(user),
    user.uid,
    version,
  );
}

/** D1 batch is atomic. A CHECK guard makes stale reads roll back every write. */
export async function atomicUser<T>(
  uid: string,
  action: () => Promise<T>,
): Promise<T> {
  if (currentUserDraft(uid)) return await action();
  for (let attempt = 0; attempt < 8; attempt++) {
    // Failed guards do not advance bookmarks; bypass lagging replicas on retry.
    const row = await primaryDatabase()
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .get();
    if (!row) throw new MonkeyError(404, "User not found");
    const user = row.data;
    const draft: Draft = {
      uid,
      user,
      statements: [],
    };
    const result = await drafts.run(draft, action);
    const guard = newId();
    try {
      await binding().batch([
        statement(
          "INSERT INTO mutation_guards(id,valid) VALUES (?,(SELECT count(*) FROM users WHERE uid=? AND version=?))",
          guard,
          uid,
          row.version,
        ),
        userStatement(draft.user, row.version),
        ...draft.statements,
        statement("DELETE FROM mutation_guards WHERE id=?", guard),
      ]);
      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? `${error.message} ${String(error.cause)}`
          : String(error);
      if (!message.includes("mutation_version")) throw error;
    }
  }
  throw new MonkeyError(409, "Concurrent update; please retry");
}

export async function mutateUser<T>(
  uid: string,
  transform: (user: DBUser) => T | Promise<T>,
): Promise<T> {
  return await atomicUser(uid, async () => {
    const user = currentUserDraft(uid);
    if (!user) throw new Error("Missing user draft");
    return await transform(user);
  });
}
