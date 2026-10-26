import { and, desc, eq } from "drizzle-orm";
import type { EditPresetRequest, Preset } from "@caret/schemas/presets";
import { database, encode, statement } from "../db/client";
import { presets } from "../db/schema";
import { atomicUser, stage } from "../db/mutation";
import { newId } from "../utils/id";
import MonkeyError from "../utils/error";
type DBConfigPreset = Preset & { uid: string };
export async function getPresets(uid: string): Promise<DBConfigPreset[]> {
  return (
    await database()
      .select()
      .from(presets)
      .where(eq(presets.uid, uid))
      .orderBy(desc(presets.timestamp))
  ).map((row) => ({ ...row.data, _id: row.id, uid }) as DBConfigPreset);
}
export async function addPreset(
  uid: string,
  preset: Omit<Preset, "_id">,
): Promise<{ presetId: string }> {
  const id = newId();
  const result = await statement(
    "INSERT INTO presets(id,uid,timestamp,data) SELECT ?,?,?,? WHERE (SELECT count(*) FROM presets WHERE uid=?) < 10",
    id,
    uid,
    Date.now(),
    encode(preset),
    uid,
  ).run();
  if (!result.meta.changes) throw new MonkeyError(409, "Too many presets");
  return { presetId: id };
}
export async function editPreset(
  uid: string,
  preset: EditPresetRequest,
): Promise<void> {
  await atomicUser(uid, async () => {
    const row = await database()
      .select()
      .from(presets)
      .where(and(eq(presets.id, preset._id), eq(presets.uid, uid)))
      .get();
    if (!row) return;
    const data = { ...row.data };
    if (preset.settingGroups !== undefined) {
      data["settingGroups"] = preset.settingGroups;
    }
    if (preset.name !== undefined) data["name"] = preset.name;
    if (preset.config !== undefined && Object.keys(preset.config).length > 0) {
      data["config"] = preset.config;
    }
    await stage(
      statement(
        "UPDATE presets SET data=? WHERE id=? AND uid=?",
        encode(data),
        preset._id,
        uid,
      ),
    );
  });
}
export async function removePreset(
  uid: string,
  presetId: string,
): Promise<void> {
  const result = await database()
    .delete(presets)
    .where(and(eq(presets.id, presetId), eq(presets.uid, uid)));
  if (!result.meta.changes) throw new MonkeyError(404, "Preset not found");
}
