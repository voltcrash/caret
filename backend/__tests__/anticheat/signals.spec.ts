import { describe, expect, it } from "vite-plus/test";
import { completedEvent } from "../__testData__/completed-event";
import {
  generatedTimings,
  humanTimings,
  type KeyTimings,
} from "../__testData__/key-timings";
import {
  getTimingReview,
  type TimingReview,
} from "../../src/anticheat/signals";
import { serverAudit } from "@caret/typing-engine/audit.server";

const probit = (p: number): number => serverAudit().probit([p])[0] as number;

function review(
  timings: KeyTimings,
  charTotal = timings.keyDuration.length,
): TimingReview | undefined {
  return getTimingReview(completedEvent({ ...timings, charTotal }));
}

describe("timing review signals", () => {
  it.each(Array.from({ length: 30 }, (_, i) => i + 1))(
    "raises nothing for modelled human timing (seed %i)",
    (seed) => {
      expect(review(humanTimings(400, seed))?.signals).toEqual([]);
    },
  );
  it("raises nothing for human timing on a 1ms or coarser clock", () => {
    const { keySpacing, keyDuration } = humanTimings(400, 9);
    const coarsen = (ms: number) => (values: number[]) =>
      values.map((value) => Math.round(value / ms) * ms);
    for (const ms of [1, 16.67, 100]) {
      expect(
        review({
          keySpacing: coarsen(ms)(keySpacing),
          keyDuration: coarsen(ms)(keyDuration),
        })?.signals,
        `${ms}ms clock`,
      ).not.toContain("small-value-pool");
    }
  });
  it("flags bounded uniform jitter", () => {
    const signals = review(
      generatedTimings(400, (random, channel) =>
        channel === "gap" ? 60 + random() * 40 : 20 + random() * 20,
      ),
    )?.signals;
    expect(signals).toContain("uniform-gaps");
    expect(signals).toContain("uniform-holds");
    expect(signals).toContain("memoryless-timing");
  });
  it("flags small gaussian jitter around a fixed interval", () => {
    const signals = review(
      generatedTimings(400, (random, channel) =>
        channel === "gap"
          ? 80 + 3 * probit(random())
          : 30 + 1 * probit(random()),
      ),
    )?.signals;
    expect(signals).toContain("low-gap-variation");
    expect(signals).toContain("low-hold-variation");
  });
  it("flags independent lognormal draws as memoryless", () => {
    const signals = review(
      generatedTimings(400, (random, channel) =>
        Math.exp(
          Math.log(channel === "gap" ? 80 : 30) + 0.3 * probit(random()),
        ),
      ),
    )?.signals;
    expect(signals).toEqual(["memoryless-timing"]);
  });
  it("flags values drawn from a small hardcoded pool", () => {
    const pool = [61.3, 72.9, 84.1, 95.7, 103.2, 118.6];
    const signals = review(
      generatedTimings(
        400,
        (random) => pool[Math.floor(random() * pool.length)] ?? 0,
      ),
    )?.signals;
    expect(signals).toContain("small-value-pool");
  });
  it("flags the exact fixed signature too, without depending on it", () => {
    expect(
      review({
        keySpacing: Array.from({ length: 219 }, () => 80),
        keyDuration: Array.from({ length: 220 }, () => 25),
      })?.signals,
    ).toEqual(
      expect.arrayContaining([
        "low-gap-variation",
        "low-hold-variation",
        "small-value-pool",
      ]),
    );
  });
  it("skips sparse, short and long-test telemetry", () => {
    expect(review(humanTimings(400), 500)).toBeUndefined();
    expect(review(humanTimings(50))).toBeUndefined();
    expect(
      getTimingReview(
        completedEvent({ keySpacing: "toolong", keyDuration: "toolong" }),
      ),
    ).toBeUndefined();
  });
  it("ignores zero hold placeholders instead of reading them as timing", () => {
    const { keySpacing } = humanTimings(400, 3);
    const result = review({
      keySpacing,
      keyDuration: Array.from({ length: 400 }, () => 0),
    });
    expect(result?.features.holds.n).toBe(0);
    expect(result?.signals).toEqual([]);
  });
  it("reports rounded features for the audit log", () => {
    const features = review(humanTimings(400, 4))?.features;
    expect(features?.gaps.n).toBe(397);
    expect(features?.gaps.cv).toBeGreaterThan(0.1);
    expect(features?.lag0Sigmas).not.toBeNull();
    expect(JSON.stringify(features).length).toBeLessThan(600);
  });
});
