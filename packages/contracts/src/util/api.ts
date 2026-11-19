import { z } from "zod";
import { RateLimiterId } from "../rate-limit";
import { RequireConfiguration } from "../require-configuration";

export type OpenApiTag =
  | "configs"
  | "presets"
  | "admin"
  | "psas"
  | "public"
  | "leaderboards"
  | "results"
  | "configuration"
  | "development"
  | "users"
  | "quotes";

export type PermissionId = "quoteMod" | "canReport" | "admin";

export type EndpointMetadata = {
  /** Authentication options, by default a bearer token is required. */
  authenticationOptions?: RequestAuthenticationOptions;

  openApiTags?: OpenApiTag | OpenApiTag[];

  /** Named rate limit shared across authenticated requests. */
  rateLimit?: RateLimiterId;

  /** Role/Rples needed to  access the endpoint*/
  requirePermission?: PermissionId | PermissionId[];

  /** Endpoint is only available if configuration allows it */
  requireConfiguration?: RequireConfiguration | RequireConfiguration[];
};

/**
 *
 * @param metadata Ensure the type of metadata is `EndpointMetadata`.
 * @returns
 */
export function meta(metadata: EndpointMetadata): EndpointMetadata {
  return metadata;
}

export type RequestAuthenticationOptions = {
  /** Endpoint is accessible without any authentication. If `false` bearer authentication is required. */
  isPublic?: boolean;
  /** Endpoint requires an authentication token which is younger than one minute.  */
  requireFreshToken?: boolean;
  noCache?: boolean;
  /** Allow unauthenticated requests on dev  */
  isPublicOnDev?: boolean;
};

export const ApiResponseSchema = z.object({
  message: z.string(),
});
export type ApiResponseType = z.infer<typeof ApiResponseSchema>;

export const ApiValidationErrorSchema = ApiResponseSchema.extend({
  validationErrors: z.array(z.string()),
});
export type ApiValidationError = z.infer<typeof ApiValidationErrorSchema>;

/** @alias */
export const ApiClientError = ApiResponseSchema;
export type ApiClientErrorType = z.infer<typeof ApiClientError>;

export const ApiServerError = ApiClientError.extend({
  errorId: z.string(),
  uid: z.string().optional(),
});
export type ApiServerErrorType = z.infer<typeof ApiServerError>;

export function responseWithNullableData<T extends z.ZodType>(
  dataSchema: T,
): z.ZodObject<
  z.core.util.Extend<
    typeof ApiResponseSchema.shape,
    {
      data: z.ZodNullable<T>;
    }
  >
> {
  return ApiResponseSchema.extend({
    data: dataSchema.nullable(),
  });
}

export function responseWithData<T extends z.ZodType>(
  dataSchema: T,
): z.ZodObject<
  z.core.util.Extend<
    typeof ApiResponseSchema.shape,
    {
      data: T;
    }
  >
> {
  return ApiResponseSchema.extend({
    data: dataSchema,
  });
}

export const CommonResponses = {
  400: ApiClientError.describe("Generic client error"),
  401: ApiClientError.describe(
    "Authentication required but not provided or invalid",
  ),
  403: ApiClientError.describe("Operation not permitted"),
  422: ApiValidationErrorSchema.describe("Request validation failed"),
  429: ApiClientError.describe("Rate limit exceeded"),
  500: ApiServerError.describe("Generic server error"),
  503: ApiServerError.describe(
    "Endpoint disabled or server is under maintenance",
  ),
};

export type CommonResponsesType =
  | {
      status: 400 | 401 | 403 | 429;
      body: ApiClientErrorType;
    }
  | {
      status: 422;
      body: ApiValidationError;
    }
  | {
      status: 500 | 503;
      body: ApiServerErrorType;
    };
