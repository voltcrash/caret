import { describe, expect, it } from "vite-plus/test";
import { initContract } from "@ts-rest/core";
import { generateOpenApi } from "@ts-rest/open-api";
import { z } from "zod/v3";

const c = initContract();
const info = { title: "Schema compatibility", version: "1.0.0" };

describe("OpenAPI dependency compatibility", () => {
  it("preserves nested constraints, defaults and descriptions", () => {
    const contract = c.router({
      create: {
        method: "POST",
        path: "/audit",
        body: z.object({
          config: z.object({
            name: z.string().min(3).describe("Display name"),
            tags: z.array(z.string()).min(1),
            enabled: z.boolean().default(true),
          }),
        }),
        responses: { 200: z.object({ id: z.string() }) },
      },
    });
    const document = generateOpenApi(contract, { info });
    expect(document.paths["/audit"]?.post?.requestBody).toMatchObject({
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["config"],
            properties: {
              config: {
                type: "object",
                required: ["name", "tags"],
                properties: {
                  name: {
                    type: "string",
                    minLength: 3,
                    description: "Display name",
                  },
                  tags: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string" },
                  },
                  enabled: { type: "boolean", default: true },
                },
              },
            },
          },
        },
      },
    });
  });

  it("preserves both sides of nested response intersections", () => {
    const contract = c.router({
      read: {
        method: "GET",
        path: "/audit",
        responses: {
          200: z.intersection(
            z.object({ config: z.object({ name: z.string() }) }),
            z.object({
              config: z.object({ enabled: z.boolean(), value: z.number() }),
            }),
          ),
        },
      },
    });
    const document = generateOpenApi(contract, { info });
    expect(document.paths["/audit"]?.get?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: {
            allOf: [
              {
                properties: {
                  config: { properties: { name: { type: "string" } } },
                },
              },
              {
                properties: {
                  config: {
                    properties: {
                      enabled: { type: "boolean" },
                      value: { type: "number" },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    });
  });
});
