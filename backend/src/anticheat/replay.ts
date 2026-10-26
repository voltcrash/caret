import type { CompletedEvent } from "@caret/schemas/results";
import objectHash from "object-hash";

// Short or nearly constant sequences can repeat by chance, especially on
// coarsened clocks. Long varied ones cannot: no hand reproduces the same
// whole-millisecond gaps and holds across 50 keys.
const MIN_REPLAY_KEYS = 50;
const MIN_REPLAY_DISTINCT_GAPS = 3;

/**
 * Fingerprint of a result's keyboard timeline, rounded to whole milliseconds
 * so sub-millisecond noise does not disguise a resubmitted recording. The
 * client hash cannot catch this: it covers timestamps and other fields a
 * replay can freely change.
 */
export function getTimingFingerprint(
  result: CompletedEvent,
): string | undefined {
  const { keySpacing, keyDuration } = result;
  if (keySpacing === "toolong" || keyDuration === "toolong") return undefined;
  return timingFingerprint(keySpacing, keyDuration, result.client);
}

/** The fingerprint of bare arrays, as stored in timing samples. */
export function timingFingerprint(
  keySpacing: number[],
  keyDuration: number[],
  _client: CompletedEvent["client"],
): string | undefined {
  const gaps = keySpacing.map(Math.round);
  if (
    gaps.length < MIN_REPLAY_KEYS ||
    new Set(gaps).size < MIN_REPLAY_DISTINCT_GAPS
  ) {
    return undefined;
  }
  return objectHash([gaps, keyDuration.map(Math.round)]);
}
