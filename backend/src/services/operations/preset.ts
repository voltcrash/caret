import {
  AddPresetRequest,
  AddPresetResponse,
  DeletePresetsParams,
  GetPresetResponse,
} from "@caret/contracts/presets";
import * as PresetDAL from "../../dal/preset";
import { ApiResponse } from "../../utils/api-response";
import { EditPresetRequest } from "@caret/schemas/presets";
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

  return new ApiResponse("Presets retrieved", data);
}

export async function addPreset(
  context: ServiceContext,
  input: OperationInput<undefined, AddPresetRequest>,
): Promise<AddPresetResponse> {
  const { uid } = context.actor;

  const data = await PresetDAL.addPreset(uid, input.body);

  return new ApiResponse("Preset created", data);
}

export async function editPreset(
  context: ServiceContext,
  input: OperationInput<undefined, EditPresetRequest>,
): Promise<ApiResponse> {
  const { uid } = context.actor;

  await PresetDAL.editPreset(uid, input.body);

  return new ApiResponse("Preset updated", null);
}

export async function removePreset(
  context: ServiceContext,
  input: OperationInput<undefined, undefined, DeletePresetsParams>,
): Promise<ApiResponse> {
  const { presetId } = input.params;
  const { uid } = context.actor;

  await PresetDAL.removePreset(uid, presetId);

  return new ApiResponse("Preset deleted", null);
}
