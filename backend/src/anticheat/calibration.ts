import {
  type ReviewSignal,
  type TimingFeatures,
  reviewKeyTimings,
} from "./signals";

export type TimingSample = {
  keySpacing: number[];
  keyDuration: number[];
  client?: "web";
  // overrides the file's label, e.g. the original upload of a replay
  label?: string;
};

type Percentiles = { p5: number; p50: number; p95: number };

export type CalibrationReport = {
  samples: number;
  // samples with enough keyboard telemetry to review at all
  reviewed: number;
  // share of reviewed samples raising each signal, and any signal
  rates: Partial<Record<ReviewSignal | "any", number>>;
  features: Record<string, Percentiles>;
};

const FEATURES: Record<string, (features: TimingFeatures) => number | null> = {
  "gaps.cv": (f) => f.gaps.cv,
  "gaps.kurtosis": (f) => f.gaps.kurtosis,
  "gaps.autocorrelationSigmas": (f) => f.gaps.autocorrelationSigmas,
  "gaps.distinctRatio": (f) =>
    f.gaps.n > 0 ? f.gaps.distinct / f.gaps.n : null,
  "holds.cv": (f) => f.holds.cv,
  "holds.kurtosis": (f) => f.holds.kurtosis,
  lag0Sigmas: (f) => f.lag0Sigmas,
  lag1Sigmas: (f) => f.lag1Sigmas,
  overlapRate: (f) => f.overlapRate,
};

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function toSample(
  record: Record<string, unknown>,
  inherited: Pick<TimingSample, "client" | "label">,
): TimingSample[] {
  const { keySpacing, keyDuration, client, label } = record;
  if (!isNumberArray(keySpacing) || !isNumberArray(keyDuration)) return [];
  const sample: TimingSample = { keySpacing, keyDuration };
  const ownClient = client === "web" ? client : undefined;
  const sampleClient = ownClient ?? inherited.client;
  if (sampleClient !== undefined) sample.client = sampleClient;
  const sampleLabel = typeof label === "string" ? label : inherited.label;
  if (sampleLabel !== undefined) sample.label = sampleLabel;
  return [sample];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Pull timing samples out of an export: a bare array, the admin audits
 * response, audit rows whose message holds the arrays, a recorded fixture
 * (`completedEvent` or `result`) or a calibration fixture (`samples`).
 * Anything else, including long-test sentinels, is skipped.
 */
export function extractSamples(input: unknown): TimingSample[] {
  if (isRecord(input)) {
    if (Array.isArray(input["samples"])) {
      const client = input["client"] === "web" ? input["client"] : undefined;
      return input["samples"].flatMap((item: unknown) =>
        isRecord(item) ? toSample(item, { client }) : [],
      );
    }
    for (const key of ["completedEvent", "result"]) {
      const record = input[key];
      if (isRecord(record)) return toSample(record, {});
    }
  }
  const items = isRecord(input) && "data" in input ? input["data"] : input;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: unknown) => {
    if (!isRecord(item)) return [];
    const message = item["message"];
    return toSample(isRecord(message) ? message : item, {});
  });
}

function percentiles(values: number[]): Percentiles {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number): number =>
    sorted[Math.round(p * (sorted.length - 1))] ?? NaN;
  return { p5: at(0.05), p50: at(0.5), p95: at(0.95) };
}

/** Signal rates and feature spreads of one labelled set of samples. */
export function calibrate(samples: TimingSample[]): CalibrationReport {
  const reviews = samples.flatMap((sample) => {
    const review = reviewKeyTimings(sample.keySpacing, sample.keyDuration);
    return review === undefined ? [] : [review];
  });
  const rates: CalibrationReport["rates"] = {};
  const rate = (count: number): number =>
    Math.round((count / reviews.length) * 10000) / 10000;
  if (reviews.length > 0) {
    const counts = new Map<ReviewSignal, number>();
    for (const { signals } of reviews) {
      for (const signal of signals) {
        counts.set(signal, (counts.get(signal) ?? 0) + 1);
      }
    }
    for (const [signal, count] of counts) rates[signal] = rate(count);
    rates.any = rate(reviews.filter((r) => r.signals.length > 0).length);
  }
  const features: CalibrationReport["features"] = {};
  for (const [name, read] of Object.entries(FEATURES)) {
    const values = reviews
      .map((review) => read(review.features))
      .filter((value): value is number => value !== null);
    if (values.length > 0) features[name] = percentiles(values);
  }
  return {
    samples: samples.length,
    reviewed: reviews.length,
    rates,
    features,
  };
}
