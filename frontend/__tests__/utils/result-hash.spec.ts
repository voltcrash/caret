import { describe, expect, it } from "vite-plus/test";

import {
  hashResult,
  preloadResultHasher,
} from "../../src/ts/utils/result-hash";

describe("result-hash", () => {
  it("matches the frozen legacy wire hash", async () => {
    const result = { wpm: 100, acc: 98.5, chartData: { wpm: [1, 2] } };
    expect(await hashResult(result)).toBe(
      "e5c8bd50bd4b32105c44ae740b8acea52214d0f0",
    );
  });

  it("reuses one loaded hasher", async () => {
    expect(await preloadResultHasher()).toBe(await preloadResultHasher());
  });
});
