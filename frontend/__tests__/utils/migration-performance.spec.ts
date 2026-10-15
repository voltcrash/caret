import { describe, expect, it } from "vite-plus/test";
import {
  compare,
  freeze,
  summarize,
} from "../../scripts/migration-performance";

describe("migration performance gates", () => {
  it("uses nearest-rank percentiles without mutating raw sample order", () => {
    const samples = [5, 1, 3, 2, 4];
    expect(summarize(samples)).toEqual({ median: 3, p95: 5, min: 1, max: 5 });
    expect(samples).toEqual([5, 1, 3, 2, 4]);
  });

  it("rejects missing, too few, negative and non-finite measurements", () => {
    for (const samples of [
      [],
      [1, 2],
      [-1, 1, 2, 3, 4],
      [Infinity, 1, 2, 3, 4],
      [NaN, 1, 2, 3, 4],
    ]) {
      expect(() => summarize(samples)).toThrow();
    }
    expect(compare(freeze({ readiness: [1, 1, 1, 1, 1] }), {})).toEqual([
      "readiness: missing samples",
    ]);
  });

  it("allows observed timing variance but rejects persistent and tail regressions", () => {
    const baseline = freeze({ readiness: [10, 10, 10, 11, 12] });
    expect(compare(baseline, { readiness: [10, 10, 11, 12, 13] })).toEqual([]);
    expect(compare(baseline, { readiness: [13, 13, 13, 13, 13] })).toEqual([
      "readiness median: 13 > 12",
    ]);
    expect(compare(baseline, { readiness: [10, 10, 10, 10, 15] })).toEqual([
      "readiness p95: 15 > 14",
    ]);
  });

  it("keeps deterministic D1/byte budgets exact and never recomputes them on check", () => {
    const baseline = freeze({
      d1Save: [8, 8, 8, 8, 8],
      eagerBytes: [100, 100, 100, 100, 100],
    });
    const before = structuredClone(baseline);
    expect(
      compare(baseline, {
        d1Save: [9, 9, 9, 9, 9],
        eagerBytes: [101, 101, 101, 101, 101],
      }),
    ).toHaveLength(4);
    expect(baseline).toEqual(before);
  });
});
