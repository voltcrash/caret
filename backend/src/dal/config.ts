import { eq } from "drizzle-orm";
import { configs } from "../db/schema";
import { database, statement } from "../db/client";
import { newId } from "../utils/id";
import type { Config, PartialConfig } from "@caret/schemas/configs";

type UpdateResult = {
  acknowledged: boolean;
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
};
export type DBConfig = { _id: string; uid: string; config: PartialConfig };
const legacy = [
  "swapEscAndTab",
  "quickTab",
  "chartStyle",
  "chartAverage10",
  "chartAverage100",
  "alwaysShowCPM",
  "resultFilters",
  "chartAccuracy",
  "liveSpeed",
  "extraTestColor",
  "savedLayout",
  "showTimerBar",
  "showDiscordDot",
  "maxConfidence",
  "capsLockBackspace",
  "showAvg",
  "enableAds",
  "ads",
];
export async function saveConfig(
  uid: string,
  config: Partial<Config>,
): Promise<UpdateResult> {
  const patch = JSON.stringify(
    Object.fromEntries(
      Object.entries(config).filter(([key]) => !legacy.includes(key)),
    ),
  );
  const paths = legacy;
  await statement(
    `INSERT INTO configs(uid,id,data) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET data=jsonb_merge_patch(configs.data,excluded.data) - ARRAY[${paths.map(() => "?").join(",")}]::text[]`,
    uid,
    newId(),
    patch,
    ...paths,
  ).run();
  return {
    acknowledged: true,
    matchedCount: 1,
    modifiedCount: 1,
    upsertedCount: 0,
  };
}
export async function getConfig(uid: string): Promise<DBConfig | null> {
  const row = (
    await database().select().from(configs).where(eq(configs.uid, uid)).limit(1)
  )[0];
  return row ? { _id: row.id, uid, config: row.data } : null;
}
export async function deleteConfig(uid: string): Promise<void> {
  await database().delete(configs).where(eq(configs.uid, uid));
}
