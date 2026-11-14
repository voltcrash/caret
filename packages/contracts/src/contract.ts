import { z } from "zod";
import type { EndpointMetadata } from "./util/api";

const noBody = Symbol("ContractNoBody");
type Schema = z.ZodType | null | typeof noBody;

type RouteFields = {
  path: string;
  pathParams?: z.ZodType;
  query?: z.ZodType;
  headers?: z.ZodType | Record<string, never>;
  responses: Record<number, Schema>;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  strictStatusCodes?: boolean;
  metadata?: EndpointMetadata;
};
export type AppRoute = RouteFields &
  (
    | { method: "GET" }
    | {
        method: "POST" | "PUT" | "PATCH" | "DELETE";
        body?: Schema;
        contentType?: "application/json";
      }
  );
export type AppRouter = { [key: string]: AppRoute | AppRouter };
type RouterOptions = {
  pathPrefix?: string;
  strictStatusCodes?: boolean;
  commonResponses?: Record<number, Schema>;
  metadata?: EndpointMetadata;
};
type Merge<A, B> = Omit<A, keyof B> & B;
type ApplyOptions<T extends AppRouter, O extends RouterOptions> = {
  [K in keyof T]: T[K] extends AppRoute
    ? Omit<T[K], "path" | "responses" | "metadata"> & {
        path: O extends { pathPrefix: infer P extends string }
          ? `${P}${T[K]["path"]}`
          : T[K]["path"];
        responses: O extends { commonResponses: infer R }
          ? Merge<R, T[K]["responses"]>
          : T[K]["responses"];
        metadata: EndpointMetadata;
      }
    : T[K] extends AppRouter
      ? ApplyOptions<T[K], O>
      : never;
};

export function isAppRoute(value: AppRoute | AppRouter): value is AppRoute {
  return "method" in value && "path" in value;
}
function applyOptions(
  router: AppRouter,
  options: RouterOptions = {},
): AppRouter {
  return Object.fromEntries(
    Object.entries(router).map(([key, value]) => [
      key,
      isAppRoute(value)
        ? {
            ...value,
            path: (options.pathPrefix ?? "") + value.path,
            headers: value.headers ?? {},
            strictStatusCodes:
              value.strictStatusCodes ?? options.strictStatusCodes,
            responses: { ...options.commonResponses, ...value.responses },
            metadata: options.metadata
              ? { ...options.metadata, ...value.metadata }
              : value.metadata,
          }
        : applyOptions(value, options),
    ]),
  );
}

/** Only the contract composition and inference used by Caret's transports. */
export function initContract(): {
  router: <
    const T extends AppRouter,
    const O extends RouterOptions = RouterOptions,
  >(
    routes: T,
    options?: O,
  ) => ApplyOptions<T, O>;
  noBody: () => typeof noBody;
} {
  return {
    router: (routes, options) =>
      applyOptions(routes, options) as ApplyOptions<
        typeof routes,
        NonNullable<typeof options>
      >,
    noBody: () => noBody,
  };
}

type PathKeys<P extends string> = P extends `${string}:${infer Rest}`
  ? Rest extends `${infer Key}/${infer Tail}`
    ? Key | PathKeys<Tail>
    : Rest
  : never;
type PathParams<P extends string> = { [K in PathKeys<P>]: string };
type Params<T extends AppRoute> = T extends {
  pathParams: infer S extends z.ZodType;
}
  ? Merge<PathParams<T["path"]>, z.input<S>>
  : PathParams<T["path"]>;
type InputMembers<T extends AppRoute> = {
  params: T extends { pathParams: z.ZodType }
    ? Params<T>
    : T["path"] extends `${string}:${string}`
      ? Params<T>
      : never;
  query: T extends { query: infer S extends z.ZodType } ? z.input<S> : never;
  body: T extends { body: infer S extends z.ZodType } ? z.input<S> : never;
};
/** Input values before Zod parsing, including defaults and transforms. */
export type ClientInferRequest<T extends AppRoute> = {
  [
    K in keyof InputMembers<T> as InputMembers<T>[K] extends never ? never : K
  ]: InputMembers<T>[K];
};
export type ClientInferResponseBody<
  T extends AppRoute,
  Status extends keyof T["responses"],
> = T["responses"][Status] extends z.ZodType
  ? z.output<T["responses"][Status]>
  : never;

export function checkZodSchema(
  data: unknown,
  schema: unknown,
  { passThroughExtraKeys = false }: { passThroughExtraKeys?: boolean } = {},
): { success: true; data: unknown } | { success: false; error: z.ZodError } {
  if (!(schema instanceof z.ZodType)) return { success: true, data };
  const result = schema.safeParse(data);
  if (!result.success) return result;
  return {
    success: true,
    data:
      passThroughExtraKeys && typeof data === "object"
        ? Object.assign({}, data, result.data)
        : result.data,
  };
}

/** Legacy HTTP query values may be JSON or unquoted strings. */
export function parseJsonQueryObject(
  query: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => {
      try {
        return [key, JSON.parse(String(value)) as unknown];
      } catch {
        return [key, value];
      }
    }),
  );
}
