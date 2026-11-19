import { PartialConfig } from "@caret/schemas/configs";
import * as ConfigDAL from "../../dal/config";
import { ApiResponse } from "../../utils/api-response";
import { GetConfigResponse } from "@caret/contracts/configs";
import type { ServiceContext, OperationInput } from "../context";

export async function getConfig(
  context: ServiceContext,
  _input: OperationInput,
): Promise<GetConfigResponse> {
  const { uid } = context.actor;
  const data = (await ConfigDAL.getConfig(uid))?.config ?? null;

  return new ApiResponse("Configuration retrieved", data);
}

export async function saveConfig(
  context: ServiceContext,
  input: OperationInput<undefined, PartialConfig>,
): Promise<ApiResponse> {
  const config = input.body;
  const { uid } = context.actor;

  await ConfigDAL.saveConfig(uid, config);

  return new ApiResponse("Config updated", null);
}

export async function deleteConfig(
  context: ServiceContext,
  _input: OperationInput,
): Promise<ApiResponse> {
  const { uid } = context.actor;

  await ConfigDAL.deleteConfig(uid);
  return new ApiResponse("Config deleted", null);
}
