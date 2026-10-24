import { describe, expect, it } from "vite-plus/test";
import { countInvalidResultFields } from "../src/result-fields";

describe("completed result field checks", () => {
  it("counts nested undefined and NaN fields", () => {
    expect(
      countInvalidResultFields({
        wpm: NaN,
        chart: [1, undefined, { burst: NaN }],
        missing: undefined,
      }),
    ).toBe(4);
  });
  it("preserves valid null, infinity and other primitive values", () => {
    expect(
      countInvalidResultFields({
        quote: null,
        wpm: Infinity,
        enabled: false,
        name: "test",
        value: 0,
      }),
    ).toBe(0);
  });
  it("only examines enumerable values and populated array slots", () => {
    expect(countInvalidResultFields(new Array(3))).toBe(0);
    const result = Object.defineProperty({}, "missing", { value: undefined });
    expect(countInvalidResultFields(result)).toBe(0);
  });
});
