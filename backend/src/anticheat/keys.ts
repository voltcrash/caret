import type { CompletedEvent } from "@oxytype/schemas/results";
import {
  consistency,
  SCORE_TOLERANCE,
  TELEMETRY_CUTOFF_SECONDS,
} from "./result";

export type KeyDataFailure =
  | "invalid-key-number"
  | "invalid-key-sentinel"
  | "key-count-mismatch"
  | "key-timeline-mismatch"
  | "key-consistency-mismatch";
// Duration is rounded to 10ms; browser clocks may also be coarsened. Do not
// demand sub-millisecond equality from independently rounded endpoint fields.
const KEY_TIMELINE_TOLERANCE_MS = 100;

export function getKeyDataFailure(
  result: CompletedEvent,
): KeyDataFailure | undefined {
  const { keySpacing, keyDuration } = result;
  if (keySpacing === "toolong" || keyDuration === "toolong") {
    return result.testDuration > TELEMETRY_CUTOFF_SECONDS &&
      keySpacing === "toolong" &&
      keyDuration === "toolong"
      ? undefined
      : "invalid-key-sentinel";
  }
  if (
    [...keySpacing, ...keyDuration].some(
      (value) =>
        !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER,
    )
  ) {
    return "invalid-key-number";
  }
  // IME/mobile input may produce characters without any keyboard events.
  // One hold is recorded per keydown, including zero placeholders for releases
  // that were not observed. There is one fewer gap than keydowns.
  if (keySpacing.length !== Math.max(0, keyDuration.length - 1)) {
    return "key-count-mismatch";
  }
  if (keyDuration.length > 0 && result.mode !== "zen" && !result.bailedOut) {
    const elapsed =
      result.startToFirstKey +
      keySpacing.reduce((sum, value) => sum + value, 0) +
      result.lastKeyToEnd;
    if (
      Math.abs(elapsed - result.testDuration * 1000) > KEY_TIMELINE_TOLERANCE_MS
    ) {
      return "key-timeline-mismatch";
    }
  }
  // The client intentionally drops the last interval for key consistency.
  if (
    Math.abs(result.keyConsistency - consistency(keySpacing.slice(0, -1))) >
    SCORE_TOLERANCE
  ) {
    return "key-consistency-mismatch";
  }
  return undefined;
}
