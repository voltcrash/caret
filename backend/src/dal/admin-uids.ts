import { eq } from "drizzle-orm";
import { database } from "../db/client";
import { adminUids } from "../db/schema";
export async function isAdmin(uid: string): Promise<boolean> {
  return (
    (
      await database()
        .select()
        .from(adminUids)
        .where(eq(adminUids.uid, uid))
        .limit(1)
    )[0] !== undefined
  );
}
