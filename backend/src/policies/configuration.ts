import type { EndpointMetadata } from "@oxytype/contracts/util/api";
import MonkeyError from "../utils/error";
import type { Configuration } from "@oxytype/schemas/configuration";
import type {
  ConfigurationPath,
  RequireConfiguration,
} from "@oxytype/contracts/require-configuration/index";
export function verifyConfiguration(
  configuration: Configuration,
  metadata: EndpointMetadata,
): void {
  for (const requirement of getRequireConfigurations(metadata) ?? []) {
    if (!getValue(configuration, requirement.path)) {
      throw new MonkeyError(
        503,
        requirement.invalidMessage ?? "This endpoint is currently unavailable.",
      );
    }
  }
}
function getValue(
  configuration: Configuration,
  path: ConfigurationPath,
): boolean {
  const keys = (path as string).split(".");
  let result: unknown = configuration;

  for (const key of keys) {
    if (result === undefined || result === null) {
      throw new MonkeyError(500, `Invalid configuration path: "${path}"`);
    }
    result = result[key];
  }

  if (result === undefined || result === null) {
    throw new MonkeyError(
      500,
      `Required configuration doesnt exist: "${path}"`,
    );
  }
  if (typeof result !== "boolean") {
    throw new MonkeyError(
      500,
      `Required configuration is not a boolean: "${path}"`,
    );
  }
  return result;
}

function getRequireConfigurations(
  metadata: EndpointMetadata | undefined,
): RequireConfiguration[] | undefined {
  if (metadata?.requireConfiguration === undefined) {
    return undefined;
  }

  if (Array.isArray(metadata.requireConfiguration)) {
    return metadata.requireConfiguration;
  }
  return [metadata.requireConfiguration];
}
