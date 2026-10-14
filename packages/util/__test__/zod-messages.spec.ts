import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import "../src/zod-messages";

function message(schema: z.ZodType, input: unknown): string[] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("zod 3 messages", () => {
  it.each([
    [z.string(), undefined, "Required"],
    [z.string(), 1, "Expected string, received number"],
    [z.number(), Number.NaN, "Expected number, received nan"],
    [z.number(), null, "Expected number, received null"],
    [z.array(z.string()), {}, "Expected array, received object"],
    [z.object({}), [], "Expected object, received array"],
    [z.number().int(), 1.5, "Expected integer, received float"],
    [z.literal("a"), "b", 'Invalid literal value, expected "a"'],
    [
      z.enum(["a", "b"]),
      "c",
      "Invalid enum value. Expected 'a' | 'b', received 'c'",
    ],
    [z.string().min(3), "ab", "String must contain at least 3 character(s)"],
    [z.string().max(1), "ab", "String must contain at most 1 character(s)"],
    [z.string().length(1), "ab", "String must contain exactly 1 character(s)"],
    [
      z.array(z.number()).min(1),
      [],
      "Array must contain at least 1 element(s)",
    ],
    [
      z.array(z.number()).max(0),
      [1],
      "Array must contain at most 0 element(s)",
    ],
    [z.number().min(2), 1, "Number must be greater than or equal to 2"],
    [z.number().positive(), 0, "Number must be greater than 0"],
    [z.number().max(2), 3, "Number must be less than or equal to 2"],
    [z.number().lt(2), 3, "Number must be less than 2"],
    [z.number().multipleOf(5), 3, "Number must be a multiple of 5"],
    [z.string().regex(/a/), "b", "Invalid"],
    [z.email(), "b", "Invalid email"],
    [z.url(), "b", "Invalid url"],
    [z.guid(), "b", "Invalid uuid"],
    [z.string().startsWith("x"), "b", 'Invalid input: must start with "x"'],
    [z.union([z.string(), z.number()]), true, "Invalid input"],
    [z.string().refine(() => false), "a", "Invalid input"],
    [z.object({ a: z.string() }).required(), {}, "Required"],
    [z.enum(["a", "b"]), undefined, "Required"],
    [z.enum(["a", "b"]), 1, "Expected 'a' | 'b', received number"],
    [
      z.literal(["a", "b"]),
      "c",
      "Invalid enum value. Expected 'a' | 'b', received 'c'",
    ],
  ] as const)("%s %j", (schema, input, expected) => {
    expect(message(schema, input)).toEqual([expected]);
  });

  it("lists unrecognized keys", () => {
    expect(message(z.strictObject({}), { a: 1, b: 2 })).toEqual([
      "Unrecognized key(s) in object: 'a', 'b'",
    ]);
  });

  it("reports discriminator options", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({ type: z.literal("a") }),
      z.object({ type: z.literal("b") }),
    ]);
    expect(message(schema, { type: "c" })).toEqual([
      "Invalid discriminator value. Expected 'a' | 'b'",
    ]);
  });

  it("uses the key's own message for record keys", () => {
    const key = z.string().startsWith("a");
    expect(message(z.record(key, z.number()), { b: 1 })).toEqual([
      'Invalid input: must start with "a"',
    ]);
  });

  it("keeps messages given to a schema", () => {
    expect(message(z.string().min(2, "too short"), "a")).toEqual(["too short"]);
  });
});
