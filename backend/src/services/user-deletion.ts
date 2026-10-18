import type { Configuration } from "@oxytype/schemas/configuration";
import { binding, statement } from "../db/client";
import { hash } from "../dal/blocklist";
import { readUser, atomicUser, stage } from "../db/mutation";
import type { DBUser } from "../dal/user";
type DeletedUserInfo = Pick<DBUser, "banned" | "name" | "email">;
/** Delete application/auth owners together; foreign keys cascade dependent rows. */
export async function deleteUserAccount(
  uid: string,
  _configuration: Configuration,
): Promise<DeletedUserInfo | undefined> {
  if ((await readUser(uid)) === undefined) {
    await binding().batch([
      statement("DELETE FROM auth_users WHERE id=?", uid),
    ]);
    return undefined;
  }
  return await atomicUser(uid, async () => {
    const user = await readUser(uid);
    const statements = [
      statement("DELETE FROM audit_logs WHERE uid=?", uid),
      statement("DELETE FROM quote_submissions WHERE submitted_by=?", uid),
      statement("DELETE FROM reports WHERE uid=?", uid),
      statement("DELETE FROM users WHERE uid=?", uid),
      statement("DELETE FROM auth_users WHERE id=?", uid),
    ];
    if (user?.banned === true) {
      for (const [kind, value] of Object.entries({
        name: user.name,
        email: user.email,
      })) {
        if (value !== undefined && value !== "") {
          statements.push(
            statement(
              "INSERT INTO blocklist(kind,hash,timestamp) VALUES(?,?,?) ON CONFLICT(kind,hash) DO UPDATE SET timestamp=excluded.timestamp",
              kind,
              hash(value),
              Date.now(),
            ),
          );
        }
      }
    }
    for (const query of statements) await stage(query);
    return user === undefined
      ? undefined
      : {
          banned: user.banned,
          name: user.name,
          email: user.email,
        };
  });
}
