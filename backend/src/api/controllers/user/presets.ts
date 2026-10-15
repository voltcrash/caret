import * as UserDAL from "../../../dal/user";
import { MonkeyResponse } from "../../../utils/monkey-response";
import {
  AddResultFilterPresetRequest,
  AddResultFilterPresetResponse,
  RemoveResultFilterPresetPathParams,
} from "@oxytype/contracts/users";
import { MonkeyRequest } from "../../types";

export async function addResultFilterPreset(
  req: MonkeyRequest<undefined, AddResultFilterPresetRequest>,
): Promise<AddResultFilterPresetResponse> {
  const { uid } = req.ctx.decodedToken;
  const filter = req.body;
  const { maxPresetsPerUser } = req.ctx.configuration.results.filterPresets;

  const createdId = await UserDAL.addResultFilterPreset(
    uid,
    filter,
    maxPresetsPerUser,
  );
  return new MonkeyResponse("Result filter preset created", createdId);
}
export async function removeResultFilterPreset(
  req: MonkeyRequest<undefined, undefined, RemoveResultFilterPresetPathParams>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const { presetId } = req.params;

  await UserDAL.removeResultFilterPreset(uid, presetId);
  return new MonkeyResponse("Result filter preset deleted", null);
}
