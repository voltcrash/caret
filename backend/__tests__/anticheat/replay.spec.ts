import { describe, expect, it } from "vite-plus/test";
import { completedEvent } from "../__testData__/completed-event";
import { humanTimings } from "../__testData__/key-timings";
import { legacyHash as objectHash } from "@caret/web-shared/legacy-hash";
import {
  getTimingFingerprint,
  matchesTimingFingerprint,
} from "../../src/anticheat/replay";

describe("key timing replay fingerprint", () => {
  it("matches a timeline resubmitted with different metadata", () => {
    const timings = humanTimings(200, 1);
    expect(
      getTimingFingerprint(completedEvent({ ...timings, timestamp: 1 })),
    ).toBe(
      getTimingFingerprint(
        completedEvent({ ...timings, timestamp: 2, wpm: 90, mode2: "60" }),
      ),
    );
  });
  it("ignores sub-millisecond noise added to a recording", () => {
    const timings = humanTimings(200, 1);
    const noisy = {
      keySpacing: timings.keySpacing.map((value) => Math.round(value) + 0.3),
      keyDuration: timings.keyDuration.map((value) => Math.round(value) - 0.3),
    };
    expect(
      getTimingFingerprint(
        completedEvent({
          keySpacing: timings.keySpacing.map(Math.round),
          keyDuration: timings.keyDuration.map(Math.round),
        }),
      ),
    ).toBe(getTimingFingerprint(completedEvent(noisy)));
  });
  it("distinguishes different tests", () => {
    expect(getTimingFingerprint(completedEvent(humanTimings(200, 1)))).not.toBe(
      getTimingFingerprint(completedEvent(humanTimings(200, 2))),
    );
  });
  it("skips short, constant and long-test timelines", () => {
    expect(
      getTimingFingerprint(completedEvent(humanTimings(40, 1))),
    ).toBeUndefined();
    expect(
      getTimingFingerprint(
        completedEvent({
          keySpacing: Array.from({ length: 99 }, (_, i) => (i % 2 ? 100 : 200)),
          keyDuration: Array.from({ length: 100 }, () => 100),
        }),
      ),
    ).toBeUndefined();
    expect(
      getTimingFingerprint(
        completedEvent({ keySpacing: "toolong", keyDuration: "toolong" }),
      ),
    ).toBeUndefined();
  });
});

describe("retained replay signatures", () => {
  const fingerprint = (timings: ReturnType<typeof humanTimings>): string => {
    const hash = getTimingFingerprint(completedEvent(timings));
    if (hash === undefined) throw new Error("Missing fingerprint");
    return hash;
  };
  it("detects changed holds while distinguishing independent recordings", () => {
    const timings = humanTimings(200, 1);
    const history = [fingerprint(timings)];
    for (const keyDuration of [
      timings.keyDuration.map((v) => v + 10),
      Array<number>(200).fill(0),
    ]) {
      expect(
        matchesTimingFingerprint(
          fingerprint({ ...timings, keyDuration }),
          history,
        ),
      ).toBe(true);
    }
    expect(
      matchesTimingFingerprint(fingerprint(humanTimings(200, 2)), history),
    ).toBe(false);
  });
  it("matches exact recordings retained before the upgrade", () => {
    const timings = humanTimings(200, 1);
    const legacy = objectHash([
      timings.keySpacing.map(Math.round),
      timings.keyDuration.map(Math.round),
    ]);
    expect(matchesTimingFingerprint(fingerprint(timings), [legacy])).toBe(true);
    expect(
      matchesTimingFingerprint(fingerprint(humanTimings(200, 2)), [legacy]),
    ).toBe(false);
  });
  it("requires longer and more varied gaps before ignoring holds", () => {
    for (const timings of [
      humanTimings(80, 1),
      {
        keySpacing: Array.from({ length: 199 }, (_, i) => 100 + (i % 3)),
        keyDuration: Array<number>(200).fill(40),
      },
    ]) {
      const edited = {
        ...timings,
        keyDuration: timings.keyDuration.map((v) => v + 10),
      };
      expect(
        matchesTimingFingerprint(fingerprint(edited), [fingerprint(timings)]),
      ).toBe(false);
    }
  });
});
