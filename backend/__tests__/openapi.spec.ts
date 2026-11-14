import { describe, expect, it } from "vite-plus/test";
import { initContract } from "@caret/contracts/contract";
import { generateOpenApi } from "../src/http/openapi-generator";
import { z } from "zod";
import { getOpenApi } from "../src/http/openapi";
import { createHash } from "node:crypto";

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
            properties: {
              config: {
                properties: {
                  name: { type: "string" },
                  enabled: { type: "boolean" },
                  value: { type: "number" },
                },
              },
            },
          },
        },
      },
    });
  });
});

function surface(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(surface);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [
          key,
          key === "schema" ? "[schema]" : surface(child),
        ]),
    );
  }
  return value;
}

it("preserves the complete retained HTTP documentation outside schema syntax", () => {
  // Captured from the old patched generator before migrating the contract.
  const serialized = JSON.stringify(surface(getOpenApi("/api")));
  expect(createHash("sha256").update(serialized).digest("hex")).toBe(
    "c4b502700a5af20810fd837c04a56072ca2e14684bf5c64a8ed6d69acce9c789",
  );
});

it("resolves native recursive schemas against the embedded OpenAPI document", () => {
  const document = getOpenApi();
  const refs: string[] = [];
  function visit(value: unknown): void {
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && typeof child === "string") refs.push(child);
      else visit(child);
    }
  }
  visit(document);
  expect(refs.length).toBeGreaterThan(0);
  for (const ref of refs) {
    let target: unknown = document;
    for (const part of ref
      .slice(2)
      .split("/")
      .map((key) => key.replace(/~1/g, "/").replace(/~0/g, "~"))) {
      if (target === null || typeof target !== "object") {
        throw new Error(`Invalid reference ${ref}`);
      }
      target = (target as Record<string, unknown>)[part];
    }
    expect(target, ref).toBeDefined();
  }
});
