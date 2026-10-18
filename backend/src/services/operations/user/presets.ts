import * as UserDAL from "../../../dal/user";
import { MonkeyResponse } from "../../../utils/monkey-response";
import {
  AddResultFilterPresetRequest,
  AddResultFilterPresetResponse,
  RemoveResultFilterPresetPathParams,
} from "@oxytype/contracts/users";
import type { ServiceContext, OperationInput } from "../../context";

export async function addResultFilterPreset(
  context: ServiceContext,
  input: OperationInput<undefined, AddResultFilterPresetRequest>,
): Promise<AddResultFilterPresetResponse> {
  const { uid } = context.actor;
  const filter = input.body;
  const { maxPresetsPerUser } = context.configuration.results.filterPresets;

  const createdId = await UserDAL.addResultFilterPreset(
    uid,
    filter,
    maxPresetsPerUser,
  );
  return new MonkeyResponse("Result filter preset created", createdId);
}
export async function removeResultFilterPreset(
  context: ServiceContext,
  input: OperationInput<
    undefined,
    undefined,
    RemoveResultFilterPresetPathParams
  >,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const { presetId } = input.params;

  await UserDAL.removeResultFilterPreset(uid, presetId);
  return new MonkeyResponse("Result filter preset deleted", null);
}
