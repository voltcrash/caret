import { describe, expect, it } from "vite-plus/test";
import { shouldRepeatQuote } from "../src/restart";

describe("quote repeat settings", () => {
  it.each(["time", "words", "quote", "custom", "zen"] as const)(
    "checks mode=%s with both preferences",
    (mode) => {
      expect(shouldRepeatQuote({ mode, repeatQuotes: "typing" })).toBe(
        mode === "quote",
      );
      expect(shouldRepeatQuote({ mode, repeatQuotes: "off" })).toBe(false);
    },
  );
});
