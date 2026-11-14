import { expect, expectTypeOf, it } from "vite-plus/test";
import { z } from "zod";
import {
  checkZodSchema,
  initContract,
  isAppRoute,
  parseJsonQueryObject,
  type ClientInferRequest,
  type ClientInferResponseBody,
} from "../src/contract";

it("composes nested paths, common responses and shallow metadata overrides", () => {
  const c = initContract();
  const response = z.object({ value: z.number() });
  const routes = c.router(
    {
      nested: c.router(
        {
          read: {
            method: "GET",
            path: "/:id",
            pathParams: z.object({ id: z.string() }),
            query: z.object({ page: z.number().default(1) }),
            responses: { 200: response },
            metadata: { authenticationOptions: { isPublic: true } },
          },
        },
        {
          pathPrefix: "/items",
          metadata: { openApiTags: "users" },
          commonResponses: { 400: z.string() },
        },
      ),
    },
    { pathPrefix: "/api", strictStatusCodes: true },
  );
  const route = routes.nested.read;
  expect(route.path).toBe("/api/items/:id");
  expect(route.responses[200]).toBe(response);
  expect(Object.keys(route.responses)).toEqual(["200", "400"]);
  expect(route).toMatchObject({
    strictStatusCodes: true,
    headers: {},
    metadata: {
      openApiTags: "users",
      authenticationOptions: { isPublic: true },
    },
  });
  expect(isAppRoute(route)).toBe(true);
  expect(isAppRoute(routes)).toBe(false);
  expectTypeOf<ClientInferRequest<typeof route>>().toExtend<{
    params: { id: string };
    query: { page?: number };
  }>();
  expectTypeOf<{ params: { id: string }; query: { page?: number } }>().toExtend<
    ClientInferRequest<typeof route>
  >();
  expectTypeOf<ClientInferResponseBody<typeof route, 200>>().toEqualTypeOf<{
    value: number;
  }>();
});

it("preserves strict validation, transforms, passthrough extras and noBody", () => {
  const schema = z.object({ id: z.string().transform(Number) });
  expect(checkZodSchema({ id: "2", extra: true }, schema)).toEqual({
    success: true,
    data: { id: 2 },
  });
  expect(
    checkZodSchema({ id: "2", extra: true }, schema, {
      passThroughExtraKeys: true,
    }),
  ).toEqual({ success: true, data: { id: 2, extra: true } });
  expect(
    checkZodSchema({ id: "2", extra: true }, schema.strict()).success,
  ).toBe(false);
  const body = { legacy: true };
  expect(checkZodSchema(body, initContract().noBody())).toEqual({
    success: true,
    data: body,
  });
  expect(checkZodSchema(undefined, undefined)).toEqual({
    success: true,
    data: undefined,
  });
});

it("decodes JSON query values with the old unquoted string fallback", () => {
  expect(
    parseJsonQueryObject({
      text: "plain",
      quoted: '"quoted"',
      number: "2",
      bool: "false",
      nil: "null",
      list: "[1,2]",
      object: '{"x":1}',
      invalid: "[",
      repeated: ["1", "2"],
    }),
  ).toEqual({
    text: "plain",
    quoted: "quoted",
    number: 2,
    bool: false,
    nil: null,
    list: [1, 2],
    object: { x: 1 },
    invalid: "[",
    repeated: ["1", "2"],
  });
});
