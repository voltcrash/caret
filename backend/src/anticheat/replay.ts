import type { CompletedEvent } from "@caret/schemas/results";
import { legacyHash as objectHash } from "@caret/web-shared/legacy-hash";

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
  const exact = objectHash([gaps, keyDuration.map(Math.round)]);
  // Keep the legacy hash so retained pre-upgrade recordings still match.
  // A second, more conservative signature prevents edits to holds (including
  // missing-release placeholders) from disguising a long varied gap sequence.
  // Both signatures occupy one history slot, preserving the retention window.
  return gaps.length >= 100 && new Set(gaps).size >= 10
    ? `${exact}:${objectHash(gaps)}`
    : exact;
}

/** Match both current fingerprints and legacy, exact-timeline history. */
export function matchesTimingFingerprint(
  fingerprint: string,
  history: string[],
): boolean {
  const [exact, gaps] = fingerprint.split(":");
  return history.some((stored) => {
    const [storedExact, storedGaps] = stored.split(":");
    return exact === storedExact || (gaps !== undefined && gaps === storedGaps);
  });
}
