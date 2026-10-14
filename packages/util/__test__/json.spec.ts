import { describe, it, expect } from "vite-plus/test";
import { parseWithSchema } from "../src/json";
import { z } from "zod/v3";

describe("json", () => {
  describe("parseWithSchema", () => {
    it("returns transformed schema output for parsed and migrated values", () => {
      const transformed = z
        .object({ count: z.number() })
        .transform(({ count }) => String(count));
      expect(parseWithSchema('{"count":2}', transformed)).toBe("2");
      expect(
        parseWithSchema('{"legacy":true}', transformed, {
          migrate: () => ({ count: 3 }) as unknown as string,
        }),
      ).toBe("3");
    });
    const schema = z.object({
      test: z.boolean().optional(),
      name: z.string(),
      nested: z.object({ foo: z.string() }).strict().optional(),
    });
    it("should throw with invalid json", () => {
      expect(() => parseWithSchema("blah", schema)).toThrow(
        new Error(
          `Invalid JSON: Unexpected token 'b', "blah" is not valid JSON`,
        ),
      );
    });
    it("should parse", () => {
      const json = `{
        "test":true,
        "name":"bob",
        "unknown":"unknown",
        "nested":{
            "foo":"bar"
        }
      }`;

      expect(parseWithSchema(json, schema)).toStrictEqual({
        test: true,
        name: "bob",
        nested: { foo: "bar" },
      });
    });
    it("should throw with invalid schema", () => {
      const json = `{
            "test":"yes",
            "nested":{
                "foo":1
            }
          }`;

      expect(() => parseWithSchema(json, schema)).toThrow(
        new Error(
          `JSON does not match schema: "test" expected boolean, received string, "name" required, "nested.foo" expected string, received number`,
        ),
      );
    });
    it("should migrate if valid json", () => {
      const json = `{
          "name": 1
          }`;

      const result = parseWithSchema(json, schema, {
        migrate: () => {
          return {
            name: "migrated",
            test: false,
          };
        },
      });

      expect(result).toStrictEqual({
        name: "migrated",
        test: false,
      });
    });
    it("should revert to fallback if invalid json", () => {
      const json = `blah`;

      const result = parseWithSchema(json, schema, {
        fallback: {
          name: "migrated",
          test: false,
        },
      });

      expect(result).toStrictEqual({
        name: "migrated",
        test: false,
      });
    });
    it("should throw if migration fails", () => {
      const json = `{
          "name": 1
          }`;

      expect(() => {
        parseWithSchema(json, schema, {
          //@ts-expect-error need to test migration failure
          migrate: () => {
            return {
              name: null,
              test: "Hi",
            };
          },
        });
      }).toThrow(
        new Error(
          `Migrated value does not match schema: "test" expected boolean, received string, "name" expected string, received null`,
        ),
      );
    });
    it("should revert to fallback if migration fails", () => {
      const json = `{
          "name": 1
          }`;

      const result = parseWithSchema(json, schema, {
        fallback: {
          name: "fallback",
          test: false,
        },
        //@ts-expect-error need to test migration failure
        migrate: () => {
          return {
            name: null,
            test: "Hi",
          };
        },
      });

      expect(result).toStrictEqual({
        name: "fallback",
        test: false,
      });
    });
    it("migrate function should receive value", () => {
      const json = `{
        "test":"test"
      }`;

      const result = parseWithSchema(json, schema, {
        migrate: (value) => {
          expect(value).toEqual({ test: "test" });
          return {
            name: "valid",
          };
        },
      });

      expect(result).toStrictEqual({
        name: "valid",
      });
    });
  });
});
