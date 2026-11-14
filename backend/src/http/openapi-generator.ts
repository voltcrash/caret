import { z } from "zod";
import {
  isAppRoute,
  type AppRoute,
  type AppRouter,
} from "@caret/contracts/contract";

type JsonSchema = Record<string, unknown>;
type Parameter = {
  name: string;
  in: "path" | "query" | "header";
  required?: boolean;
  description?: unknown;
  schema?: JsonSchema;
  content?: Record<string, { schema: JsonSchema }>;
};
type Response = {
  description: string;
  content?: Record<string, { schema: JsonSchema }>;
  headers?: Record<string, unknown>;
};
export type OperationObject = {
  description?: string;
  summary?: string;
  deprecated?: boolean;
  tags: string[];
  parameters: Parameter[];
  operationId?: string;
  requestBody?: {
    description: string;
    content: Record<string, { schema: JsonSchema }>;
  };
  responses: Record<string, Response>;
  security?: Record<string, string[]>[];
  [extension: `x-${string}`]: unknown;
};
export type OpenApiDocument = {
  openapi: string;
  info: { title: string; version: string; [key: string]: unknown };
  paths: Record<
    string,
    Partial<Record<Lowercase<AppRoute["method"]>, OperationObject>>
  >;
  [key: string]: unknown;
};

function jsonSchema(schema: z.core.$ZodType, output = false): JsonSchema {
  const result = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: output ? "output" : "input",
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema: generated }) => {
      const def = zodSchema._zod.def;
      // Keep the previous open-object documentation for stripping objects.
      // Closing each side of an intersection would reject their merged result.
      if (def.type === "default" && generated.default === undefined) {
        generated.default = def.defaultValue;
      }
      if (def.type === "object" && def.catchall === undefined) {
        delete generated.additionalProperties;
      }
      if (output && def.type === "pipe" && def.out instanceof z.ZodTransform) {
        // Caret's output transforms are String/Number or optional-string
        // normalization with nonrecursive inputs. Keep their constraints
        // instead of emitting `{}`; recursive transform inputs are not supported.
        Object.assign(generated, jsonSchema(def.in));
        const transform = def.out._zod.def.transform;
        if (transform === String) generated.type = "string";
        if (transform === Number) generated.type = "number";
      }
    },
  });
  delete result.$schema;
  return result;
}
function parameters(
  schema: AppRoute["query"],
  location: "path" | "query" | "header",
  jsonQuery: boolean,
): Parameter[] {
  if (!(schema instanceof z.ZodObject)) return [];
  return Object.entries(schema.shape as Record<string, z.ZodType>).map(
    ([name, field]) => {
      const result = jsonSchema(field);
      const description = result["description"];
      if (location !== "header") delete result["description"];
      return {
        name,
        in: location,
        ...(location === "path" || !field.safeParse(undefined).success
          ? { required: true }
          : {}),
        ...(location !== "header" &&
        typeof description === "string" &&
        description !== ""
          ? { description }
          : {}),
        ...(location === "query" && jsonQuery
          ? { content: { "application/json": { schema: result } } }
          : { schema: result }),
      };
    },
  );
}

/** Retained HTTP documentation; runtime validation always uses the original Zod schema. */
export function generateOpenApi(
  router: AppRouter,
  document: Omit<OpenApiDocument, "paths" | "openapi"> & {
    info: OpenApiDocument["info"];
    openapi?: string;
  },
  options: {
    jsonQuery?: boolean;
    setOperationId?: "concatenated-path";
    operationMapper?: (
      operation: OperationObject,
      route: AppRoute,
    ) => OperationObject;
  } = {},
): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};
  function visit(routes: AppRouter, groups: string[]): void {
    for (const [name, route] of Object.entries(routes)) {
      if (!isAppRoute(route)) {
        visit(route, [...groups, name]);
        continue;
      }
      const path = route.path.replace(/:(\w+)/g, "{$1}");
      const pathParams = parameters(route.pathParams, "path", false);
      const implicitParams: Parameter[] = [...path.matchAll(/\{([^}]+)\}/g)]
        .map((match) => match[1] as string)
        .filter(
          (key) => !pathParams.some((parameter) => parameter.name === key),
        )
        .map((key) => ({
          name: key,
          in: "path",
          required: true,
          schema: { type: "string" },
        }));
      const responses: Record<string, Response> = Object.fromEntries(
        Object.entries(route.responses).map(([status, response]) => [
          status,
          {
            description:
              response instanceof z.ZodType &&
              response.description !== undefined &&
              response.description !== ""
                ? response.description
                : status,
            ...(response instanceof z.ZodType
              ? {
                  content: {
                    "application/json": { schema: jsonSchema(response, true) },
                  },
                }
              : {}),
          },
        ]),
      );
      const body =
        "body" in route && route.body instanceof z.ZodType
          ? jsonSchema(route.body)
          : undefined;
      const operation: OperationObject = {
        description: route.description,
        summary: route.summary,
        deprecated: route.deprecated,
        tags: groups,
        parameters: [
          ...implicitParams,
          ...pathParams,
          ...parameters(
            route.headers instanceof z.ZodType ? route.headers : undefined,
            "header",
            false,
          ),
          ...parameters(route.query, "query", options.jsonQuery ?? false),
        ],
        ...(options.setOperationId
          ? { operationId: [...groups, name].join(".") }
          : {}),
        ...(body
          ? {
              requestBody: {
                description: "Body",
                content: { "application/json": { schema: body } },
              },
            }
          : {}),
        responses,
      };
      paths[path] ??= {};
      paths[path][route.method.toLowerCase() as Lowercase<AppRoute["method"]>] =
        options.operationMapper?.(operation, route) ?? operation;
    }
  }
  visit(router, []);
  const result = { openapi: "3.1.0", ...document, paths };
  qualifySchemaReferences(result);
  return result;
}

/** Native recursive schemas use local refs; embedded OpenAPI schemas need full document pointers. */
function qualifySchemaReferences(
  value: unknown,
  path = "",
  schemaRoot?: string,
): void {
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (
      key === "$ref" &&
      typeof child === "string" &&
      (child === "#" || child.startsWith("#/")) &&
      schemaRoot !== undefined
    ) {
      (value as Record<string, unknown>)[key] =
        `#${schemaRoot}${child.slice(1)}`;
      continue;
    }
    const pointer = `${path}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`;
    qualifySchemaReferences(
      child,
      pointer,
      schemaRoot ?? (key === "schema" ? pointer : undefined),
    );
  }
}
