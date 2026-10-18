import { eq, and, inArray } from "drizzle-orm";

import { database, statement, encode } from "../../db/client";
import { mutateUser, stage } from "../../db/mutation";
import { inbox, rewardGrants } from "../../db/schema";

import type { Badge, MonkeyMail } from "@oxytype/schemas/users";

import type { Configuration } from "@oxytype/schemas/configuration";

import { getUser } from "./queries";
import { readInbox } from "./inbox-read";
export async function getInbox(uid: string): Promise<MonkeyMail[]> {
  await getUser(uid, "get inbox");
  return await readInbox(uid);
}
export async function addToInbox(
  uid: string,
  mail: MonkeyMail[],
  config: Configuration["users"]["inbox"],
): Promise<void> {
  if (!config.enabled) return;
  await mutateUser(uid, async () => {
    for (const item of mail) {
      await stage(
        statement(
          "INSERT INTO inbox(id,uid,timestamp,read,data) VALUES(?,?,?,?,?) ON CONFLICT(uid,id) DO NOTHING",
          item.id,
          uid,
          item.timestamp,
          Number(item.read),
          encode(item),
        ),
      );
      await stage(
        statement(
          "INSERT INTO reward_grants(id,uid,origin,claimed,data) VALUES(?,?,?,?,?) ON CONFLICT(origin,uid) DO NOTHING",
          `${uid}:${item.id}`,
          uid,
          item.id,
          Number(item.read),
          encode({ rewards: item.rewards }),
        ),
      );
    }
    await stage(
      statement(
        "DELETE FROM inbox WHERE uid=? AND id NOT IN (SELECT id FROM inbox WHERE uid=? ORDER BY timestamp DESC,id DESC LIMIT ?)",
        uid,
        uid,
        config.maxMail,
      ),
    );
  });
}
export async function updateInbox(
  uid: string,
  mailToRead: string[],
  mailToDelete: string[],
): Promise<void> {
  const ids = [...new Set([...mailToRead, ...mailToDelete])];
  if (!ids.length) return;
  await mutateUser(uid, async (user) => {
    const mails = await database()
      .select()
      .from(inbox)
      .where(
        and(
          eq(inbox.uid, uid),
          inArray(inbox.id, ids),
          eq(inbox.deleted, false),
        ),
      );
    const grants = await database()
      .select()
      .from(rewardGrants)
      .where(
        and(
          eq(rewardGrants.uid, uid),
          inArray(
            rewardGrants.origin,
            mails.map((mail) => mail.id),
          ),
          eq(rewardGrants.claimed, false),
        ),
      );
    const badges: Badge[] = [...(user.inventory?.badges ?? [])];
    for (const grant of grants) {
      const rewards = (grant.data["rewards"] ?? []) as MonkeyMail["rewards"];
      for (const reward of rewards) {
        if (reward.type === "xp") {
          if (reward.client !== undefined && reward.client !== "web") continue;
          const profile = user;
          profile.xp = (profile.xp ?? 0) + reward.item;
        } else if (
          reward.type === "badge" &&
          !badges.some((badge) => badge.id === reward.item.id)
        ) {
          badges.push(reward.item);
        }
      }
      await stage(
        statement(
          "UPDATE reward_grants SET claimed=1 WHERE id=? AND uid=?",
          grant.id,
          uid,
        ),
      );
    }
    user.inventory = { ...user.inventory, badges };
    for (const mail of mails) {
      await stage(
        statement(
          "UPDATE inbox SET read=1,deleted=? WHERE id=? AND uid=?",
          Number(mailToDelete.includes(mail.id)),
          mail.id,
          uid,
        ),
      );
    }
  });
}
