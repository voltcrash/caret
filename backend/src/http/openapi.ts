import { isRetainedHttpOperation } from "./retention";
import type { OperationId } from "../policies/operations";
import { generateOpenApi } from "@ts-rest/open-api";
import { COMPATIBILITY_CHECK, contract } from "@oxytype/contracts/index";
import { EndpointMetadata, PermissionId } from "@oxytype/contracts/util/api";
type OpenAPIObject = ReturnType<typeof generateOpenApi>;
type OperationObject = Parameters<
  NonNullable<
    NonNullable<Parameters<typeof generateOpenApi>[2]>["operationMapper"]
  >
>[0];
import {
  RateLimitIds,
  getLimits,
  RateLimiterId,
  Window,
} from "@oxytype/contracts/rate-limit/index";
import { formatDuration } from "date-fns";

type SecurityRequirementObject = {
  [name: string]: string[];
};

export function getOpenApi(basePath = "/"): OpenAPIObject {
  const retained = Object.fromEntries(
    Object.entries(contract).map(([group, routes]) => [
      group,
      Object.fromEntries(
        Object.entries(routes).filter(([name]) =>
          isRetainedHttpOperation(`${group}.${name}` as OperationId),
        ),
      ),
    ]),
  );
  const openApiDocument = generateOpenApi(
    retained,
    {
      openapi: "3.1.0",
      info: {
        title: "Oxytype API",
        description:
          "Documentation for the endpoints provided by the Oxytype API server.\n\nNote that authentication is performed with the Authorization HTTP header in the format `Authorization: ApeKey YOUR_APE_KEY`\n\nThere is a rate limit of `30 requests per minute` across all endpoints with some endpoints being more strict. Rate limit rates are shared across all ape keys.",
        version: `2.${COMPATIBILITY_CHECK}.0`,
        contact: {
          name: "Oxytype repository",
          url: "https://github.com/voltcrash/oxytype",
        },
        license: {
          name: "GPL-3.0",
          url: "https://www.gnu.org/licenses/gpl-3.0.html",
        },
      },
      servers: [
        {
          url: basePath,
          description: "Current server",
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
          },
          ApeKey: {
            type: "http",
            scheme: "ApeKey",
          },
        },
      },
      tags: [
        {
          name: "users",
          description: "User account data.",
          "x-displayName": "Users",
          "x-public": "yes",
        },
        {
          name: "configs",
          description:
            "User specific configs like test settings, theme or tags.",
          "x-displayName": "User configs",
          "x-public": "no",
        },
        {
          name: "presets",
          description: "User specific configuration presets.",
          "x-displayName": "User presets",
          "x-public": "no",
        },
        {
          name: "results",
          description: "User test results",
          "x-displayName": "Test results",
          "x-public": "yes",
        },
        {
          name: "ape-keys",
          description: "Ape keys provide access to certain API endpoints.",
          "x-displayName": "Ape Keys",
          "x-public": "no",
        },
        {
          name: "public",
          description: "Public endpoints such as typing stats.",
          "x-displayName": "Public",
          "x-public": "yes",
        },
        {
          name: "leaderboards",
          description: "All-time and daily leaderboards of the fastest typers.",
          "x-displayName": "Leaderboards",
        },
        {
          name: "psas",
          description: "Public service announcements.",
          "x-displayName": "PSAs",
          "x-public": "yes",
        },
        {
          name: "quotes",
          description: "Quote ratings and new quote submissions",
          "x-displayName": "Quotes",
          "x-public": "yes",
        },
        {
          name: "admin",
          description:
            "Various administrative endpoints. Require user to have admin permissions.",
          "x-displayName": "Admin",
          "x-public": "no",
        },
        {
          name: "configuration",
          description: "Server configuration",
          "x-displayName": "Server configuration",
          "x-public": "yes",
        },
        {
          name: "development",
          description:
            "Development related endpoints. Only available on dev environment",
          "x-displayName": "Development",
          "x-public": "no",
        },
      ],
    },

    {
      jsonQuery: true,
      setOperationId: "concatenated-path",
      operationMapper: (operation, route) => {
        const metadata = route.metadata as EndpointMetadata;
        if (!operation.description?.trim()?.endsWith(".")) {
          operation.description += ".";
        }
        operation.description += "\n\n";

        addAuth(operation, metadata);
        addRateLimit(operation, metadata);
        addRequiredConfiguration(operation, metadata);
        addTags(operation, metadata);
        return operation;
      },
    },
  );
  return openApiDocument;
}

function addAuth(
  operation: OperationObject,
  metadata: EndpointMetadata | undefined,
): void {
  const auth = metadata?.authenticationOptions ?? {};
  const permissions = getRequiredPermissions(metadata) ?? [];
  const security: SecurityRequirementObject[] = [];
  if (!auth.isPublic && !auth.isPublicOnDev) {
    security.push({ BearerAuth: permissions });

    if (auth.acceptApeKeys === true) {
      security.push({ ApeKey: permissions });
    }
  }

  const includeInPublic = auth.isPublic === true || auth.acceptApeKeys === true;
  operation["x-public"] = includeInPublic ? "yes" : "no";
  operation.security = security;

  if (permissions.length !== 0) {
    operation.description += `**Required permissions:** ${permissions.join(
      ", ",
    )}\n\n`;
  }
}

function getRequiredPermissions(
  metadata: EndpointMetadata | undefined,
): PermissionId[] | undefined {
  if (metadata?.requirePermission === undefined) {
    return undefined;
  }

  if (Array.isArray(metadata.requirePermission)) {
    return metadata.requirePermission;
  }
  return [metadata.requirePermission];
}

function addTags(
  operation: OperationObject,
  metadata: EndpointMetadata | undefined,
): void {
  if (metadata?.openApiTags === undefined) return;
  operation.tags = Array.isArray(metadata.openApiTags)
    ? metadata.openApiTags
    : [metadata.openApiTags];
}

function addRateLimit(
  operation: OperationObject,
  metadata: EndpointMetadata | undefined,
): void {
  if (metadata?.rateLimit === undefined) return;
  const okResponse = operation.responses["200"] as
    | {
        headers?: Record<string, unknown>;
      }
    | undefined;
  if (okResponse === undefined) return;

  operation.description += getRateLimitDescription(metadata.rateLimit);

  okResponse.headers = {
    ...okResponse.headers,
    "x-ratelimit-limit": {
      schema: { type: "integer" },
      description: "The number of allowed requests in the current period",
    },
    "x-ratelimit-remaining": {
      schema: { type: "integer" },
      description: "The number of remaining requests in the current period",
    },
    "x-ratelimit-reset": {
      schema: { type: "integer" },
      description: "The timestamp of the start of the next period",
    },
  };
}

function getRateLimitDescription(limit: RateLimiterId | RateLimitIds): string {
  const limits = getLimits(limit);

  let result = `**Rate limit:** This operation can be called up to ${
    limits.limiter.max
  } times ${formatWindow(limits.limiter.window)} for regular users`;

  if (limits.apeKeyLimiter !== undefined) {
    result += ` and up to ${limits.apeKeyLimiter.max} times ${formatWindow(
      limits.apeKeyLimiter.window,
    )} with ApeKeys`;
  }

  return `${result}.\n\n`;
}

function formatWindow(window: Window): string {
  if (typeof window === "number") {
    const seconds = Math.floor(window / 1000);
    const duration = formatDuration({
      hours: Math.floor(seconds / 3600),
      minutes: Math.floor(seconds / 60) % 60,
      seconds: seconds % 60,
    });

    return `every ${duration}`;
  }
  return `per ${window}`;
}

function addRequiredConfiguration(
  operation: OperationObject,
  metadata: EndpointMetadata | undefined,
): void {
  if (metadata?.requireConfiguration === undefined) {
    return;
  }

  //@ts-expect-error somehow path doesnt exist
  operation.description += `**Required configuration:** This operation can only be called if the [configuration](#tag/configuration/operation/configuration.get) for  \`${metadata.requireConfiguration.path}\` is \`true\`.\n\n`;
}
