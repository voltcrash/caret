import type { CompletedEvent } from "@oxytype/schemas/results";
import { serverAudit } from "@oxytype/typing-engine/audit.server";
import type {
  ReviewSignal,
  TimingFeatures,
  TimingReview,
} from "@oxytype/typing-engine/audit";

/**
 * Statistical review signals, computed by the Rust engine. Unlike the checks
 * in result.ts, keys.ts and bot.ts, none of these is proof: each describes a
 * property that synthetic generators commonly have and that human samples
 * rarely show. They are logged for review and calibration, never used to
 * reject a result or add a strike.
 */
export type { ReviewSignal, TimingFeatures, TimingReview };

/**
 * Review the interior key timings of a result. Returns undefined when there is
 * too little keyboard telemetry to describe: long-test sentinels, IME/mobile
 * input and short tests.
 */
export function getTimingReview(
  result: CompletedEvent,
): TimingReview | undefined {
  const { keySpacing, keyDuration } = result;
  if (keySpacing === "toolong" || keyDuration === "toolong") return undefined;
  if (keyDuration.length < result.charTotal) return undefined;
  return reviewKeyTimings(keySpacing, keyDuration);
}

/** The review on bare arrays, as stored in timing samples. */
export function reviewKeyTimings(
  keySpacing: number[],
  keyDuration: number[],
): TimingReview | undefined {
  return serverAudit().review(keySpacing, keyDuration) ?? undefined;
}
