import * as Configuration from "../../init/configuration";
import { ApiResponse } from "../../utils/api-response";
import { CONFIGURATION_FORM_SCHEMA } from "../../constants/base-configuration";
import {
  ConfigurationSchemaResponse,
  GetConfigurationResponse,
  PatchConfigurationRequest,
} from "@caret/contracts/configuration";
import MonkeyError from "../../utils/error";
import type { ServiceContext, OperationInput } from "../context";

export async function getConfiguration(
  _context: ServiceContext,
  _input: OperationInput,
): Promise<GetConfigurationResponse> {
  const currentConfiguration = await Configuration.getCachedConfiguration(true);
  return new ApiResponse("Configuration retrieved", currentConfiguration);
}

export async function getSchema(
  _context: ServiceContext,
  _input: OperationInput,
): Promise<ConfigurationSchemaResponse> {
  return new ApiResponse(
    "Configuration schema retrieved",
    CONFIGURATION_FORM_SCHEMA,
  );
}

export async function updateConfiguration(
  _context: ServiceContext,
  input: OperationInput<undefined, PatchConfigurationRequest>,
): Promise<ApiResponse> {
  const { configuration } = input.body;
  const success = await Configuration.patchConfiguration(configuration);

  if (!success) {
    throw new MonkeyError(500, "Configuration update failed");
  }

  return new ApiResponse("Configuration updated", null);
}
