import { hasFixedTimingSignature, MIN_BOT_TIMING_SAMPLES } from "./bot";
import type { TimingSample } from "./calibration";
import { timingFingerprint } from "./replay";
import { type ReviewSignal, reviewKeyTimings } from "./signals";

/** Every timing detector: the rejecting checks and the log-only signals. */
export type Detector = "fixed-timing" | "replayed-timing" | ReviewSignal;

export const DETECTORS: readonly Detector[] = [
  "fixed-timing",
  "replayed-timing",
  "uniform-gaps",
  "uniform-holds",
  "low-gap-variation",
  "low-hold-variation",
  "memoryless-timing",
  "small-value-pool",
];

const HOLD_SIGNALS = new Set<Detector>([
  "uniform-holds",
  "low-hold-variation",
  "memoryless-timing",
]);
const MEMORYLESS_MIN_GAPS = 200;

export type Verdict = {
  // detectors with enough telemetry to judge this sample
  applicable: Detector[];
  flagged: Detector[];
};

function interior(values: number[]): number[] {
  return values.slice(1, -1).filter((value) => value > 0);
}

/**
 * Run every detector over one user's samples, in order. A sample counts as
 * replayed when an earlier sample in the same list has its fingerprint, as the
 * per-user replay check would see it.
 */
export function detect(samples: TimingSample[]): Verdict[] {
  const seen = new Set<string>();
  return samples.map(({ keySpacing, keyDuration, client = "web" }) => {
    const applicable: Detector[] = [];
    const flagged: Detector[] = [];
    const gaps = interior(keySpacing).length;
    const holds = interior(keyDuration).length;

    if (keySpacing.slice(1, -1).length >= MIN_BOT_TIMING_SAMPLES) {
      applicable.push("fixed-timing");
      if (hasFixedTimingSignature(keySpacing, keyDuration, client)) {
        flagged.push("fixed-timing");
      }
    }

    const fingerprint = timingFingerprint(keySpacing, keyDuration, client);
    if (fingerprint !== undefined) {
      applicable.push("replayed-timing");
      if (seen.has(fingerprint)) flagged.push("replayed-timing");
      seen.add(fingerprint);
    }

    const review = reviewKeyTimings(keySpacing, keyDuration);
    if (review !== undefined) {
      for (const signal of DETECTORS.slice(2)) {
        if (HOLD_SIGNALS.has(signal) && holds < MIN_BOT_TIMING_SAMPLES) {
          continue;
        }
        if (signal === "memoryless-timing" && gaps < MEMORYLESS_MIN_GAPS) {
          continue;
        }
        applicable.push(signal);
      }
      flagged.push(...review.signals);
    }
    return { applicable, flagged };
  });
}

export type LabelKind = "human" | "bot" | "other";

/** Labels starting with "human" or "bot" set the ground truth. */
export function labelKind(label: string): LabelKind {
  if (label.startsWith("human")) return "human";
  if (label.startsWith("bot")) return "bot";
  return "other";
}

type Rate = { applicable: number; flagged: number; rate: number | null };

export type DetectorLabelReport = {
  kind: LabelKind;
  samples: number;
  detectors: Record<Detector, Rate>;
  // samples flagged by at least one detector, over all samples
  any: Rate;
};

export type DetectorCalibration = {
  labels: Record<string, DetectorLabelReport>;
  // flagged human samples over applicable human samples
  falsePositiveRate: Record<Detector | "any", number | null>;
  // unflagged bot samples over applicable bot samples; for "any", bot samples
  // that no detector flags
  falseNegativeRate: Record<Detector | "any", number | null>;
};

function rate(flagged: number, applicable: number): Rate {
  return {
    applicable,
    flagged,
    rate:
      applicable === 0 ? null : Math.round((flagged / applicable) * 1e4) / 1e4,
  };
}

function tally(verdicts: Verdict[]): {
  detectors: Record<Detector, Rate>;
  any: Rate;
} {
  const detectors = Object.fromEntries(
    DETECTORS.map((detector) => [
      detector,
      rate(
        verdicts.filter((v) => v.flagged.includes(detector)).length,
        verdicts.filter((v) => v.applicable.includes(detector)).length,
      ),
    ]),
  ) as Record<Detector, Rate>;
  return {
    detectors,
    any: rate(
      verdicts.filter((v) => v.flagged.length > 0).length,
      verdicts.length,
    ),
  };
}

/** Per-label detector rates plus false positive/negative rates by detector. */
export function calibrateDetectors(
  // one user's samples per entry, in submission order
  histories: Map<string, TimingSample[]>,
  labelOf: (key: string) => string = (key) => key,
): DetectorCalibration {
  const verdictsByLabel = new Map<string, Verdict[]>();
  const byKind: Record<LabelKind, Verdict[]> = {
    human: [],
    bot: [],
    other: [],
  };
  for (const [key, samples] of histories) {
    const label = labelOf(key);
    detect(samples).forEach((verdict, index) => {
      // a sample may carry its own label, e.g. the original of a replay
      const own = samples[index]?.label ?? label;
      verdictsByLabel.set(own, [...(verdictsByLabel.get(own) ?? []), verdict]);
      byKind[labelKind(own)].push(verdict);
    });
  }
  const human = tally(byKind.human);
  const bot = tally(byKind.bot);
  const missed = (r: Rate): number | null =>
    r.rate === null ? null : Math.round((1 - r.rate) * 1e4) / 1e4;
  return {
    labels: Object.fromEntries(
      [...verdictsByLabel].map(([label, verdicts]) => [
        label,
        {
          kind: labelKind(label),
          samples: verdicts.length,
          ...tally(verdicts),
        },
      ]),
    ),
    falsePositiveRate: {
      ...(Object.fromEntries(
        DETECTORS.map((d) => [d, human.detectors[d].rate]),
      ) as Record<Detector, number | null>),
      any: human.any.rate,
    },
    falseNegativeRate: {
      ...(Object.fromEntries(
        DETECTORS.map((d) => [d, missed(bot.detectors[d])]),
      ) as Record<Detector, number | null>),
      any: missed(bot.any),
    },
  };
}
