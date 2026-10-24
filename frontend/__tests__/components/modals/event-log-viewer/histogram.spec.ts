import { describe, expect, it } from "vite-plus/test";
import { browserAudit } from "../../../__harness__/browser-audit";

import {
  bucketIndex,
  bucketLabels,
  bucketRangeLabel,
  bucketRangeMs,
  BUCKETS,
  type BucketSpec,
  buildHistogram,
  categoryPosition,
  getBucketDivisor,
  histogramTooltipLines,
} from "../../../../src/ts/components/modals/event-log-viewer/histogram";

const absolute: BucketSpec = {
  edges: [0, 10, 20],
  axisTitle: "ms",
  relativeToMedian: false,
};

const relative: BucketSpec = {
  edges: [0, 1, 2],
  axisTitle: "× median",
  relativeToMedian: true,
};

describe("BUCKETS", () => {
  it("has ascending edges starting at 0", () => {
    for (const spec of Object.values(BUCKETS)) {
      expect(spec.edges[0]).toBe(0);
      expect([...spec.edges].sort((a, b) => a - b)).toEqual(spec.edges);
    }
  });
});

describe("bucket labels", () => {
  it("marks the last bucket open ended", () => {
    expect(bucketLabels(absolute)).toEqual(["0", "10", "20+"]);
  });

  it("describes a bucket range", () => {
    expect(bucketRangeLabel(absolute, 0)).toBe("0 - 10ms");
    expect(bucketRangeLabel(absolute, 2)).toBe("20ms and over");
    expect(bucketRangeLabel(relative, 1)).toBe("1 - 2× median");
  });

  it("converts a relative bucket to milliseconds", () => {
    expect(bucketRangeMs(relative, 0, 120)).toBe("0 - 120ms");
    expect(bucketRangeMs(relative, 2, 120)).toBe("240ms and over");
  });
});

describe("bucketIndex", () => {
  it("finds the bucket by lower edge", () => {
    expect(bucketIndex(absolute, 0)).toBe(0);
    expect(bucketIndex(absolute, 9.9)).toBe(0);
    expect(bucketIndex(absolute, 10)).toBe(1);
    expect(bucketIndex(absolute, 500)).toBe(2);
  });

  it("puts values below the first edge in the first bucket", () => {
    expect(bucketIndex(absolute, -5)).toBe(0);
  });
});

describe("categoryPosition", () => {
  it("interpolates inside a bucket", () => {
    expect(categoryPosition(absolute, 0)).toBe(-0.5);
    expect(categoryPosition(absolute, 5)).toBe(0);
    expect(categoryPosition(absolute, 15)).toBe(1);
  });

  it("centres values in the open ended bucket", () => {
    expect(categoryPosition(absolute, 99)).toBe(2);
  });
});

describe("getBucketDivisor", () => {
  it("is 1 for absolute buckets", () => {
    expect(getBucketDivisor(absolute, [100, 200, 300], browserAudit)).toBe(1);
  });

  it("is the median for relative buckets", () => {
    expect(getBucketDivisor(relative, [100, 200, 300], browserAudit)).toBe(200);
  });

  it("falls back to 1 without data", () => {
    expect(getBucketDivisor(relative, [], browserAudit)).toBe(1);
  });
});

describe("buildHistogram", () => {
  it("counts values per bucket with a running total", () => {
    expect(buildHistogram(absolute, [1, 2, 15, 30, 40], 1)).toEqual({
      bins: [2, 1, 2],
      cumulative: [2, 3, 5],
      total: 5,
    });
  });

  it("divides values before bucketing", () => {
    expect(buildHistogram(relative, [50, 150, 250], 100).bins).toEqual([
      1, 1, 1,
    ]);
  });

  it("is all zeros without data", () => {
    expect(buildHistogram(absolute, [], 1)).toEqual({
      bins: [0, 0, 0],
      cumulative: [0, 0, 0],
      total: 0,
    });
  });
});

describe("histogramTooltipLines", () => {
  it("reports count and cumulative share", () => {
    const h = buildHistogram(absolute, [1, 2, 15, 30], 1);
    expect(histogramTooltipLines(h, 1)).toEqual([
      "1 of 4 (25.0%)",
      "cumulative 75.0%",
    ]);
  });

  it("handles an empty histogram", () => {
    const h = buildHistogram(absolute, [], 1);
    expect(histogramTooltipLines(h, 0)).toEqual([
      "0 of 0 (0.0%)",
      "cumulative 0.0%",
    ]);
  });
});
