import { expect, it } from "vite-plus/test";
import { TypingStatsSchema } from "../src/users";

it("accepts accumulated fractional typing seconds in public profiles", () => {
  expect(TypingStatsSchema.parse({ timeTyping: 123.456 })).toEqual({
    timeTyping: 123.456,
  });
});

it("rejects negative typing time and fractional test counts", () => {
  expect(TypingStatsSchema.safeParse({ timeTyping: -1 }).success).toBe(false);
  expect(TypingStatsSchema.safeParse({ completedTests: 1.5 }).success).toBe(
    false,
  );
});
