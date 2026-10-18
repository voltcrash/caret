import * as Configuration from "../../init/configuration";
import { MonkeyResponse } from "../../utils/monkey-response";
import { CONFIGURATION_FORM_SCHEMA } from "../../constants/base-configuration";
import {
  ConfigurationSchemaResponse,
  GetConfigurationResponse,
  PatchConfigurationRequest,
} from "@oxytype/contracts/configuration";
import MonkeyError from "../../utils/error";
import type { ServiceContext, OperationInput } from "../context";

export async function getConfiguration(
  _context: ServiceContext,
  _input: OperationInput,
): Promise<GetConfigurationResponse> {
  const currentConfiguration = await Configuration.getCachedConfiguration(true);
  return new MonkeyResponse("Configuration retrieved", currentConfiguration);
}

export async function getSchema(
  _context: ServiceContext,
  _input: OperationInput,
): Promise<ConfigurationSchemaResponse> {
  return new MonkeyResponse(
    "Configuration schema retrieved",
    CONFIGURATION_FORM_SCHEMA,
  );
}

export async function updateConfiguration(
  _context: ServiceContext,
  input: OperationInput<undefined, PatchConfigurationRequest>,
): Promise<MonkeyResponse> {
  const { configuration } = input.body;
  const success = await Configuration.patchConfiguration(configuration);

  if (!success) {
    throw new MonkeyError(500, "Configuration update failed");
  }

  return new MonkeyResponse("Configuration updated", null);
}
