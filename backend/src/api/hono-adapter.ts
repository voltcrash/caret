import type { z } from "zod";

type ZodIssue = z.core.$ZodIssue;
import {
  type AppRoute,
  type AppRouter,
  type ServerInferRequest,
  type ServerInferResponses,
  checkZodSchema,
  isAppRoute,
  isAppRouteNoBody,
  isAppRouteOtherResponse,
  parseJsonQueryObject,
  TsRestResponseError,
} from "@ts-rest/core";
import type { Hono } from "hono";
import type { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";
import type { ApiContext, ApiEnv, ApiMiddleware, HttpRequest } from "./http";

type RouteImplementation<T extends AppRoute> = {
  middleware?: ApiMiddleware[];
  handler: (
    input: ServerInferRequest<T> & { req: HttpRequest },
  ) => Promise<ServerInferResponses<T>>;
};
export type RouterImplementation<T extends AppRouter> = {
  [K in keyof T]: T[K] extends AppRoute
    ? RouteImplementation<T[K]>
    : T[K] extends AppRouter
      ? RouterImplementation<T[K]>
      : never;
};

/** Keep implementations checked against the shared client/OpenAPI contract. */
export function initServer(): {
  router: <T extends AppRouter>(
    contract: T,
    router: RouterImplementation<T>,
  ) => RouterImplementation<T>;
} {
  return { router: (_contract, router) => router };
}

type RuntimeRoute = {
  middleware?: ApiMiddleware[];
  handler: (input: {
    req: HttpRequest;
    params: unknown;
    headers: unknown;
    query: unknown;
    body: unknown;
  }) => Promise<{ status: number; body: unknown }>;
};
type RuntimeRouter = { [key: string]: RuntimeRoute | RuntimeRouter };

export function createHonoEndpoints<T extends AppRouter>(
  contract: T,
  router: RouterImplementation<T>,
  app: Hono<ApiEnv>,
  globalMiddleware: ApiMiddleware[],
): void {
  registerRouter(contract, router as unknown as RuntimeRouter);

  function registerRouter(
    schema: AppRouter,
    implementation: RuntimeRouter,
  ): void {
    for (const [key, route] of Object.entries(schema)) {
      const entry = implementation[key];
      if (entry === undefined) {
        throw new Error(`Missing route implementation: ${key}`);
      }
      if (!isAppRoute(route)) {
        registerRouter(route, entry as RuntimeRouter);
        continue;
      }
      const endpoint = entry as RuntimeRoute;
      app.on(
        route.method,
        route.path.replace(/\/$/, "") || "/",
        async (c, next) => {
          decodeURIComponent(new URL(c.req.url).pathname);
          const req = c.get("request");
          req.tsRestRoute = route;
          req.params = c.req.param();
          await next();
        },
        ...globalMiddleware,
        ...(endpoint.middleware ?? []),
        async (c) => {
          const req = c.get("request");
          const params = checkZodSchema(req.params, route.pathParams, {
            passThroughExtraKeys: true,
          });
          const headers = checkZodSchema(req.headers, route.headers, {
            passThroughExtraKeys: true,
          });
          const query = checkZodSchema(
            parseJsonQueryObject(req.query as Record<string, string>),
            route.query,
          );
          const body = checkZodSchema(
            req.body,
            "body" in route ? route.body : null,
          );
          const failure = [
            { result: params, message: "Invalid path parameter schema" },
            { result: query, message: "Invalid query schema" },
            { result: body, message: "Invalid request data schema" },
            { result: headers, message: "Invalid header schema" },
          ].find(({ result }) => !result.success);
          if (failure !== undefined && !failure.result.success) {
            return c.json(
              {
                message: failure.message,
                validationErrors: failure.result.error.issues
                  .flatMap(formatValidationIssue)
                  .map(
                    (issue) =>
                      `${issue.path.length > 0 ? `"${issue.path.join(".")}" ` : ""}${issue.message}`,
                  ),
              },
              422,
            );
          }
          if (
            !params.success ||
            !headers.success ||
            !query.success ||
            !body.success
          ) {
            throw new Error("Unrecognized contract validation failure");
          }
          let response: { status: number; body: unknown };
          try {
            response = await endpoint.handler({
              req,
              params: params.data,
              headers: headers.data,
              query: query.data,
              body: body.data,
            });
          } catch (error) {
            if (!(error instanceof TsRestResponseError)) throw error;
            response = { status: error.statusCode, body: error.body };
          }
          const responseType = route.responses[response.status];
          if (responseType !== undefined && isAppRouteNoBody(responseType)) {
            return c.body(null, response.status as StatusCode);
          }
          if (
            responseType !== undefined &&
            isAppRouteOtherResponse(responseType)
          ) {
            return c.newResponse(
              response.body as Parameters<ApiContext["newResponse"]>[0],
              response.status as StatusCode,
              {
                "Content-Type": responseType.contentType,
              },
            );
          }
          return c.json(response.body, response.status as ContentfulStatusCode);
        },
      );
    }
  }
}

// Codes that made Zod 3 abort a union branch instead of marking it dirty.
const abortingCodes = new Set<ZodIssue["code"]>([
  "invalid_type",
  "invalid_value",
  "invalid_union",
  "invalid_key",
  "invalid_element",
]);

// Zod 3 reported the first union branch whose type matched but whose checks
// failed (e.g. a too-long optional string next to a `""` literal). Zod 4
// reports the union itself, so unwrap to keep the API's validation errors.
function formatValidationIssue(issue: ZodIssue): ZodIssue[] {
  if (issue.code === "invalid_union") {
    const branches: ZodIssue[][] = issue.errors;
    const dirty = branches.find(
      (branch) =>
        branch.length > 0 &&
        branch.every((branchIssue) => !abortingCodes.has(branchIssue.code)),
    );
    if (dirty !== undefined) {
      // Union branch issues are relative to the union.
      return dirty.flatMap((branchIssue) =>
        formatValidationIssue({
          ...branchIssue,
          path: [...issue.path, ...branchIssue.path],
        }),
      );
    }
  }
  return [issue];
}
