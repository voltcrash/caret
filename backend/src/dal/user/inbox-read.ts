import { eq, and, desc } from "drizzle-orm";

import { database } from "../../db/client";

import { inbox } from "../../db/schema";

import type { MonkeyMail } from "@oxytype/schemas/users";

export async function readInbox(uid: string): Promise<MonkeyMail[]> {
  const rows = await database()
    .select()
    .from(inbox)
    .where(and(eq(inbox.uid, uid), eq(inbox.deleted, false)))
    .orderBy(desc(inbox.timestamp));
  return rows.map(
    (row) =>
      ({
        ...row.data,
        id: row.id,
        read: row.read,
        rewards: row.read ? [] : row.data["rewards"],
      }) as MonkeyMail,
  );
}
