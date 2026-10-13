import { describe, expect, it } from "vite-plus/test";

import {
  flagNote,
  isLowStat,
  type MetricKind,
  MIN_SAMPLE_FOR_FLAGS,
  STAT_DEFINITIONS,
  STAT_EXAMPLES,
  statBalloon,
  type StatKey,
  SUSPICIOUS,
} from "../../../../src/ts/components/modals/event-log-viewer/stat-notes";

const kinds: MetricKind[] = ["spacing", "duration"];
const stats = Object.keys(STAT_DEFINITIONS) as StatKey[];

describe("STAT_EXAMPLES", () => {
  it("has an example for every stat and kind", () => {
    for (const kind of kinds) {
      expect(Object.keys(STAT_EXAMPLES[kind]).sort()).toEqual(
        [...stats].sort(),
      );
    }
  });
});

describe("statBalloon", () => {
  it("joins definition, example and flag note", () => {
    expect(statBalloon("cv", "spacing")).toBe(
      `${STAT_DEFINITIONS.cv} ${STAT_EXAMPLES.spacing.cv} Flagged red below ${SUSPICIOUS.spacing.cv}.`,
    );
  });

  it("produces text for every stat", () => {
    for (const kind of kinds) {
      for (const stat of stats) {
        expect(statBalloon(stat, kind).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("flagNote", () => {
  it("uses the per kind limits", () => {
    expect(flagNote("spreadLow", "duration")).toBe(
      ` Flagged red below ${SUSPICIOUS.duration.spreadLow}.`,
    );
    expect(flagNote("distinct", "spacing")).toBe(
      ` Flagged red below ${SUSPICIOUS.spacing.distinct} distinct values.`,
    );
    expect(flagNote("percentiles", "spacing")).toBe(
      ` Flagged red when the median is under ${SUSPICIOUS.spacing.median}ms.`,
    );
  });

  it("explains the stats that are not flagged", () => {
    for (const stat of ["spreadHigh", "runs", "drift", "acf1", "quantum"]) {
      expect(flagNote(stat as StatKey, "spacing")).toContain("Not flagged");
    }
  });

  it("mentions the minimum sample size on n", () => {
    expect(flagNote("n", "spacing")).toContain(String(MIN_SAMPLE_FOR_FLAGS));
  });

  it("is empty for stats without a note", () => {
    expect(flagNote("mean", "spacing")).toBe("");
    expect(flagNote("sd", "duration")).toBe("");
  });
});

describe("isLowStat", () => {
  it("flags values under the limit", () => {
    expect(isLowStat(0.1, 0.15, MIN_SAMPLE_FOR_FLAGS)).toBe(true);
    expect(isLowStat(0.15, 0.15, MIN_SAMPLE_FOR_FLAGS)).toBe(false);
  });

  it("holds flags on small samples", () => {
    expect(isLowStat(0.1, 0.15, MIN_SAMPLE_FOR_FLAGS - 1)).toBe(false);
  });

  it("never flags a missing value", () => {
    expect(isLowStat(null, 0.15, 1000)).toBe(false);
  });
});
