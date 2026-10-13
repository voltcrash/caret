import { computeDistStats } from "@oxytype/util/timing-stats";

import type { MetricKind } from "./stat-notes";

export type BucketSpec = {
  /** lower edge of each bucket. the last one is open ended */
  edges: number[];
  axisTitle: string;
  /** divide every value by the median before bucketing */
  relativeToMedian: boolean;
};

/**
 * Fixed buckets, so histograms are directly comparable between event logs.
 * Spacing is bucketed as a multiple of its own median because the gap between
 * keys scales with typing speed - 12000/wpm ms - so absolute edges would put a
 * fast typist and a slow one in completely different buckets. Hold times do not
 * scale that way, they sit around 60-120ms whoever is typing, so duration uses
 * absolute milliseconds where the boundaries are physical.
 */
export const BUCKETS: Record<MetricKind, BucketSpec> = {
  spacing: {
    edges: [
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4,
      1.5, 1.6, 1.7, 1.8, 1.9, 2, 3,
    ],
    axisTitle: "× median",
    relativeToMedian: true,
  },
  duration: {
    edges: [
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160,
      170, 180, 190, 200,
    ],
    axisTitle: "ms",
    relativeToMedian: false,
  },
};

export function bucketLabels(spec: BucketSpec): string[] {
  return spec.edges.map((edge, i) =>
    i === spec.edges.length - 1 ? `${edge}+` : `${edge}`,
  );
}

export function bucketRangeLabel(spec: BucketSpec, index: number): string {
  const lower = spec.edges[index] as number;
  const upper = spec.edges[index + 1];
  const unit = spec.relativeToMedian ? "× median" : "ms";
  if (upper === undefined) return `${lower}${unit} and over`;
  return `${lower} - ${upper}${unit}`;
}

export function bucketRangeMs(
  spec: BucketSpec,
  index: number,
  medianMs: number,
): string {
  const lower = (spec.edges[index] as number) * medianMs;
  const upper = spec.edges[index + 1];
  if (upper === undefined) return `${lower.toFixed(0)}ms and over`;
  return `${lower.toFixed(0)} - ${(upper * medianMs).toFixed(0)}ms`;
}

export function bucketIndex(spec: BucketSpec, value: number): number {
  for (let i = spec.edges.length - 1; i >= 0; i--) {
    if (value >= (spec.edges[i] as number)) return i;
  }
  return 0;
}

/**
 * Position on the category axis for an exact value, interpolated inside its
 * bucket so the percentile markers do not just snap to bucket centres. Category
 * i spans i-0.5 to i+0.5 in index space.
 */
export function categoryPosition(spec: BucketSpec, value: number): number {
  const index = bucketIndex(spec, value);
  const lower = spec.edges[index] as number;
  const upper = spec.edges[index + 1];
  if (upper === undefined) return index;
  const fraction = upper > lower ? (value - lower) / (upper - lower) : 0.5;
  return index - 0.5 + fraction;
}

export type Histogram = {
  bins: number[];
  /** running total of bins, for the cumulative tooltip line */
  cumulative: number[];
  total: number;
};

/**
 * What every value is divided by before bucketing. Spacing buckets are
 * multiples of the median, taken from scaleValues so the buckets hold still
 * while a subset of the log is shown.
 */
export function getBucketDivisor(
  spec: BucketSpec,
  scaleValues: number[],
): number {
  if (!spec.relativeToMedian) return 1;
  const scale = computeDistStats(scaleValues);
  return scale !== null && scale.p50 > 0 ? scale.p50 : 1;
}

export function buildHistogram(
  spec: BucketSpec,
  values: number[],
  divisor: number,
): Histogram {
  const bins = new Array<number>(spec.edges.length).fill(0);
  for (const value of values) {
    const index = bucketIndex(spec, value / divisor);
    bins[index] = (bins[index] as number) + 1;
  }
  const cumulative: number[] = [];
  let running = 0;
  for (const count of bins) {
    running += count;
    cumulative.push(running);
  }
  return { bins, cumulative, total: values.length };
}

/** count and cumulative share of one bucket, as tooltip lines */
export function histogramTooltipLines(h: Histogram, index: number): string[] {
  const count = h.bins[index] ?? 0;
  const cumulative = h.cumulative[index] ?? 0;
  const pct = h.total > 0 ? (count / h.total) * 100 : 0;
  const cumulativePct = h.total > 0 ? (cumulative / h.total) * 100 : 0;
  return [
    `${count} of ${h.total} (${pct.toFixed(1)}%)`,
    `cumulative ${cumulativePct.toFixed(1)}%`,
  ];
}
