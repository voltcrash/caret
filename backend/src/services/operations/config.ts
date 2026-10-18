import { PartialConfig } from "@oxytype/schemas/configs";
import * as ConfigDAL from "../../dal/config";
import { MonkeyResponse } from "../../utils/monkey-response";
import { GetConfigResponse } from "@oxytype/contracts/configs";
import type { ServiceContext, OperationInput } from "../context";

export async function getConfig(
  context: ServiceContext,
  _input: OperationInput,
): Promise<GetConfigResponse> {
  const { uid } = context.actor;
  const data = (await ConfigDAL.getConfig(uid))?.config ?? null;

  return new MonkeyResponse("Configuration retrieved", data);
}

export async function saveConfig(
  context: ServiceContext,
  input: OperationInput<undefined, PartialConfig>,
): Promise<MonkeyResponse> {
  const config = input.body;
  const { uid } = context.actor;

  await ConfigDAL.saveConfig(uid, config);

  return new MonkeyResponse("Config updated", null);
}

export async function deleteConfig(
  context: ServiceContext,
  _input: OperationInput,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;

  await ConfigDAL.deleteConfig(uid);
  return new MonkeyResponse("Config deleted", null);
}
