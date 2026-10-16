import {
  type AppRoute,
  type AppRouter,
  type ServerInferRequest,
  type ServerInferResponses,
  isAppRoute,
  isAppRouteNoBody,
  isAppRouteOtherResponse,
  parseJsonQueryObject,
  TsRestResponseError,
} from "@ts-rest/core";
import type { Hono } from "hono";
import type { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";
import type { ApiContext, ApiEnv, ApiMiddleware, HttpRequest } from "./http";
import { validateOperationInput } from "../policies/validation";

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
          const validation = validateOperationInput(route, {
            params: req.params,
            headers: req.headers,
            query: parseJsonQueryObject(req.query as Record<string, string>),
            body: req.body,
          });
          if (!validation.success) {
            return c.json(
              {
                message: validation.message,
                validationErrors: validation.validationErrors,
              },
              422,
            );
          }
          let response: { status: number; body: unknown };
          try {
            response = await endpoint.handler({
              req,
              params: validation.input.params,
              headers: req.headers,
              query: validation.input.query,
              body: validation.input.body,
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
