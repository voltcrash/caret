import type { CompletedEvent } from "@oxytype/schemas/results";

export type BotFailure = "uniform-key-timing";
export const MIN_BOT_TIMING_SAMPLES = 100;
const FIXED_TIMING_TOLERANCE_MS = 0.01;

function fixedPositiveTimings(values: number[]): boolean {
  if (values.length < MIN_BOT_TIMING_SAMPLES) {
    return false;
  }
  const first = values[0];
  if (first === undefined || first <= 0 || !Number.isFinite(first)) {
    return false;
  }
  return values.every(
    (value) =>
      Number.isFinite(value) &&
      value > 0 &&
      Math.abs(value - first) <= FIXED_TIMING_TOLERANCE_MS,
  );
}

/** A deliberately narrow signature, not a general human/bot classifier. */
export function getBotFailure(result: CompletedEvent): BotFailure | undefined {
  const { keySpacing, keyDuration } = result;
  if (keySpacing === "toolong" || keyDuration === "toolong") {
    return undefined;
  }
  // Compositions/automatic text can insert several characters per physical
  // key. Do not classify their sparse keyboard telemetry as automated typing.
  if (keyDuration.length < result.charTotal) {
    return undefined;
  }
  return hasFixedTimingSignature(keySpacing, keyDuration, result.client)
    ? "uniform-key-timing"
    : undefined;
}

/** The signature on bare arrays, as stored in timing samples. */
export function hasFixedTimingSignature(
  keySpacing: number[],
  keyDuration: number[],
  _client: CompletedEvent["client"],
): boolean {
  // Ignore endpoints: the first key may predate start; the final release can
  // be estimated. Both channels must be fixed across at least 100 samples.
  return (
    fixedPositiveTimings(keySpacing.slice(1, -1)) &&
    fixedPositiveTimings(keyDuration.slice(1, -1))
  );
}
