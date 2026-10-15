import { describe, it, expect, vi } from "vite-plus/test";
import { initContract, TsRestResponseError } from "@ts-rest/core";
import { Hono } from "hono";
import { z } from "zod";
import { ApiEnv, ApiMiddleware } from "../../src/api/http";
import { createHonoEndpoints, initServer } from "../../src/api/hono-adapter";
import contextMiddleware from "../../src/middlewares/context";
import { parseRequestBody } from "../../src/middlewares/body";
import errorHandlingMiddleware from "../../src/middlewares/error";

const c = initContract();
const contract = c.router({
  nested: {
    read: {
      method: "GET",
      path: "/validation/:id/",
      pathParams: z.object({ id: z.coerce.number().positive() }),
      headers: z.object({ "x-mode": z.literal("test") }),
      query: z
        .object({
          count: z.number().default(1),
          tags: z.array(z.string()).optional(),
        })
        .strict(),
      responses: { 200: c.type<unknown>() },
    },
    write: {
      method: "POST",
      path: "/validation",
      body: z.object({ value: z.coerce.number() }).strict(),
      responses: { 200: c.type<unknown>() },
    },
  },
  empty: {
    method: "DELETE",
    path: "/empty",
    body: c.noBody(),
    responses: { 204: c.noBody() },
  },
  text: {
    method: "GET",
    path: "/text",
    responses: {
      200: c.otherResponse({ contentType: "text/plain", body: z.string() }),
    },
  },
  error: {
    method: "GET",
    path: "/response-error",
    responses: { 400: z.object({ message: z.string() }) },
  },
});

function setup(): {
  app: Hono<ApiEnv>;
  order: string[];
  handler: ReturnType<typeof vi.fn>;
} {
  const app = new Hono<ApiEnv>({ strict: false });
  app.onError(errorHandlingMiddleware);
  app.use(parseRequestBody);
  app.use(contextMiddleware);
  const order: string[] = [];
  const globalMiddleware: ApiMiddleware = async (_c, next) => {
    order.push("global");
    await next();
  };
  const endpointMiddleware: ApiMiddleware = async (_c, next) => {
    order.push("endpoint");
    await next();
  };
  const handler = vi.fn();
  const router = initServer().router(contract, {
    nested: {
      read: {
        middleware: [endpointMiddleware],
        handler: async (input) => {
          order.push("handler");
          handler(input);
          return {
            status: 200,
            body: {
              params: input.params,
              query: input.query,
              mode: input.headers["x-mode"],
            },
          };
        },
      },
      write: { handler: async (input) => ({ status: 200, body: input.body }) },
    },
    empty: { handler: async () => ({ status: 204, body: undefined }) },
    text: { handler: async () => ({ status: 200, body: "plain response" }) },
    error: {
      handler: async () => {
        throw new TsRestResponseError(contract.error, {
          status: 400,
          body: { message: "contract error" },
        });
      },
    },
  });
  createHonoEndpoints(contract, router, app, [globalMiddleware]);
  return { app, order, handler };
}

describe("Hono contract adapter", () => {
  it("recurses, decodes JSON queries and runs schema transformations/defaults", async () => {
    const { app, order, handler } = setup();
    const response = await app.request(
      '/validation/42?count=3&tags=["a","b"]',
      { headers: { "X-Mode": "test" } },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      params: { id: 42 },
      query: { count: 3, tags: ["a", "b"] },
      mode: "test",
    });
    expect(order).toEqual(["global", "endpoint", "handler"]);
    expect(handler).toHaveBeenCalledOnce();
    const defaults = await app.request("/validation/1/", {
      headers: { "X-Mode": "test" },
    });
    expect(await defaults.json()).toEqual({
      params: { id: 1 },
      query: { count: 1 },
      mode: "test",
    });
  });
  it("preserves repeated query keys", async () => {
    const { app } = setup();
    const response = await app.request("/validation/1?tags=a&tags=b", {
      headers: { "X-Mode": "test" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      query: { tags: ["a", "b"] },
    });
  });
  it("prioritizes path validation and retains the issue path", async () => {
    const { app, order, handler } = setup();
    const response = await app.request("/validation/invalid?count=invalid");
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      message: "Invalid path parameter schema",
      validationErrors: ['"id" Expected number, received nan'],
    });
    expect(order).toEqual(["global", "endpoint"]);
    expect(handler).not.toHaveBeenCalled();
  });
  it("prioritizes query validation over headers", async () => {
    const { app } = setup();
    const response = await app.request("/validation/1?extra=true");
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      message: "Invalid query schema",
      validationErrors: ["Unrecognized key(s) in object: 'extra'"],
    });
  });
  it("validates lowercase request headers", async () => {
    const { app } = setup();
    const response = await app.request("/validation/1");
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      message: "Invalid header schema",
      validationErrors: [expect.stringContaining('"x-mode"')],
    });
  });
  it("validates body schemas and passes transformed bodies to controllers", async () => {
    const { app } = setup();
    const success = await app.request("/validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"value":"42"}',
    });
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({ value: 42 });
    const failure = await app.request("/validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"value":42,"extra":true}',
    });
    expect(failure.status).toBe(422);
    expect(await failure.json()).toMatchObject({
      message: "Invalid request data schema",
    });
  });
  it("returns 400 for malformed percent escapes before middleware", async () => {
    const { app, order } = setup();
    const response = await app.request("/validation/%ZZ");
    expect(response.status).toBe(400);
    expect(order).toEqual([]);
  });
  it("supports contract no-body and non-JSON responses", async () => {
    const { app } = setup();
    const empty = await app.request("/empty", { method: "DELETE" });
    expect(empty.status).toBe(204);
    expect(await empty.text()).toBe("");
    expect(empty.headers.get("content-type")).toBeNull();
    const text = await app.request("/text");
    expect(text.status).toBe(200);
    expect(text.headers.get("content-type")).toBe("text/plain");
    expect(await text.text()).toBe("plain response");
  });
  it("returns deliberate ts-rest error responses", async () => {
    const { app } = setup();
    const response = await app.request("/response-error");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "contract error" });
  });
  it("rejects missing implementations at startup", () => {
    const { app } = setup();
    expect(() => createHonoEndpoints(contract, {} as never, app, [])).toThrow(
      "Missing route implementation: nested",
    );
  });
});
