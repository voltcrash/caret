import type { CompletedEvent } from "@caret/schemas/results";
import {
  serverAudit,
  resetServerAudit,
} from "@caret/typing-engine/audit.server";
import { EngineFailure } from "@caret/typing-engine/failure";
import type {
  ReviewSignal,
  TimingFeatures,
  TimingReview,
} from "@caret/typing-engine/audit";

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
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return reviewKeyTimings(keySpacing, keyDuration);
    } catch (error) {
      if (!(error instanceof EngineFailure) || error.code !== "internal") {
        throw error;
      }
      resetServerAudit();
      console.error("Typing timing review engine trapped", {
        event: "timing_review_engine_trap",
        attempt: attempt + 1,
        cause: error.cause,
      });
    }
  }
  // Advisory signals must not turn a reproducible engine trap into a failed
  // save. Required integrity checks have already run; do not invent a verdict.
  return undefined;
}

/** The review on bare arrays, as stored in timing samples. */
export function reviewKeyTimings(
  keySpacing: number[],
  keyDuration: number[],
): TimingReview | undefined {
  return serverAudit().review(keySpacing, keyDuration) ?? undefined;
}
