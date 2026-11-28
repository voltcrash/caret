import { and, desc, eq } from "drizzle-orm";
import type { EditPresetRequest, Preset } from "@caret/schemas/presets";
import { database, encode, statement } from "../db/client";
import { presets } from "../db/schema";
import { commitBatch } from "../db/commit";
import { newId } from "../utils/id";
import ApiError from "../utils/error";
type DBConfigPreset = Preset & { uid: string };
export async function getPresets(uid: string): Promise<DBConfigPreset[]> {
  return (
    await database()
      .select()
      .from(presets)
      .where(eq(presets.uid, uid))
      .orderBy(desc(presets.timestamp))
  ).map((row) => ({ ...row.data, _id: row.id, uid }));
}
export async function addPreset(
  uid: string,
  preset: Omit<Preset, "_id">,
): Promise<{ presetId: string }> {
  const id = newId();
  const committed = await commitBatch([
    statement(
      "SELECT pg_advisory_xact_lock(hashtextextended(?,0))",
      `presets:${uid}`,
    ),
    statement(
      "INSERT INTO presets(id,uid,timestamp,data) SELECT ?,?,?,? WHERE (SELECT count(*) FROM presets WHERE uid=?) < 10",
      id,
      uid,
      Date.now(),
      encode(preset),
      uid,
    ),
  ]);
  const inserted =
    committed.results?.[1]?.rowCount ??
    ((await statement("SELECT id FROM presets WHERE id=?", id).first()) === null
      ? 0
      : 1);
  if (inserted === 0) throw new ApiError(409, "Too many presets");
  return { presetId: id };
}
export async function editPreset(
  uid: string,
  preset: EditPresetRequest,
): Promise<void> {
  const patch: Partial<Omit<Preset, "_id">> = {};
  if (preset.settingGroups !== undefined) {
    patch.settingGroups = preset.settingGroups;
  }
  if (preset.name !== undefined) patch.name = preset.name;
  if (preset.config !== undefined && Object.keys(preset.config).length > 0) {
    patch.config = preset.config;
  }
  const result = await statement(
    "UPDATE presets SET data = data || ?::jsonb WHERE id=? AND uid=?",
    encode(patch),
    preset._id,
    uid,
  ).run();
  if ((result.rowCount ?? 0) === 0) {
    throw new ApiError(404, "Preset not found");
  }
}
export async function removePreset(
  uid: string,
  presetId: string,
): Promise<void> {
  const result = await database()
    .delete(presets)
    .where(and(eq(presets.id, presetId), eq(presets.uid, uid)));
  if ((result.rowCount ?? 0) === 0) {
    throw new ApiError(404, "Preset not found");
  }
}
