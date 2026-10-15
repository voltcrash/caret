import {
  AddPresetRequest,
  AddPresetResponse,
  DeletePresetsParams,
  GetPresetResponse,
} from "@oxytype/contracts/presets";
import * as PresetDAL from "../../dal/preset";
import { MonkeyResponse } from "../../utils/monkey-response";
import { EditPresetRequest } from "@oxytype/schemas/presets";
import type { ServiceContext, OperationInput } from "../context";

export async function getPresets(
  context: ServiceContext,
  _input: OperationInput,
): Promise<GetPresetResponse> {
  const { uid } = context.actor;

  const data = (await PresetDAL.getPresets(uid)).map((preset) => ({
    ...preset,
    uid: undefined,
  }));

  return new MonkeyResponse("Presets retrieved", data);
}

export async function addPreset(
  context: ServiceContext,
  input: OperationInput<undefined, AddPresetRequest>,
): Promise<AddPresetResponse> {
  const { uid } = context.actor;

  const data = await PresetDAL.addPreset(uid, input.body);

  return new MonkeyResponse("Preset created", data);
}

export async function editPreset(
  context: ServiceContext,
  input: OperationInput<undefined, EditPresetRequest>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;

  await PresetDAL.editPreset(uid, input.body);

  return new MonkeyResponse("Preset updated", null);
}

export async function removePreset(
  context: ServiceContext,
  input: OperationInput<undefined, undefined, DeletePresetsParams>,
): Promise<MonkeyResponse> {
  const { presetId } = input.params;
  const { uid } = context.actor;

  await PresetDAL.removePreset(uid, presetId);

  return new MonkeyResponse("Preset deleted", null);
}
