import { describe, expect, it } from "vite-plus/test";
import { completedEvent } from "../__testData__/completed-event";
import { getResultFailure } from "../../src/anticheat/result";

describe("result integrity", () => {
  it("accepts the client score formula, including correct letters in wrong words", () => {
    expect(getResultFailure(completedEvent())).toBeUndefined();
    expect(
      getResultFailure(completedEvent({ charStats: [200, 0, 0, 200] })),
    ).toBeUndefined();
  });
  it.each(["wpm", "rawWpm"] as const)("rejects forged %s", (field) => {
    expect(getResultFailure(completedEvent({ [field]: 120 }))).toBe(
      "score-mismatch",
    );
  });
  it.each([NaN, Infinity, -Infinity])(
    "rejects unsafe numeric telemetry %s",
    (value) => {
      expect(getResultFailure(completedEvent({ testDuration: value }))).toBe(
        "invalid-number",
      );
      expect(getResultFailure(completedEvent({ charTotal: value }))).toBe(
        "invalid-number",
      );
      expect(
        getResultFailure(
          completedEvent({
            incompleteTests: [{ seconds: value, acc: 100 }],
            restartCount: 1,
          }),
        ),
      ).toBe("incomplete-test-mismatch");
    },
  );
  it("checks raw character count and untyped misses separately", () => {
    expect(getResultFailure(completedEvent({ charTotal: 200 }))).toBe(
      "invalid-character-count",
    );
    expect(getResultFailure(completedEvent({ charTotal: 220.5 }))).toBe(
      "invalid-number",
    );
  });
  it("permits two-decimal score rounding but rejects inflation", () => {
    expect(getResultFailure(completedEvent({ wpm: 80.005 }))).toBeUndefined();
    expect(getResultFailure(completedEvent({ wpm: 80.02 }))).toBe(
      "score-mismatch",
    );
  });
  it("checks AFK time without changing the WPM denominator", () => {
    expect(
      getResultFailure(completedEvent({ afkDuration: 20 })),
    ).toBeUndefined();
    expect(getResultFailure(completedEvent({ afkDuration: 31 }))).toBe(
      "invalid-duration",
    );
  });
  it.each(["60", "120"])("rejects a shortened %s-second result", (mode2) => {
    expect(getResultFailure(completedEvent({ mode2 }))).toBe(
      "invalid-duration",
    );
  });
  it("allows infinite tests, timer delays and bailouts", () => {
    expect(getResultFailure(completedEvent({ mode2: "0" }))).toBeUndefined();
    expect(getResultFailure(completedEvent({ mode2: "15" }))).toBeUndefined();
    expect(
      getResultFailure(completedEvent({ mode2: "60", bailedOut: true })),
    ).toBeUndefined();
    expect(
      getResultFailure(completedEvent({ mode: "zen", mode2: "zen" })),
    ).toBeUndefined();
  });
  it.each(["30junk", "NaN", "-30", "9007199254740992"])(
    "rejects malformed time settings %s",
    (mode2) => {
      expect(getResultFailure(completedEvent({ mode2 }))).toBe("invalid-mode");
    },
  );
  it.each([
    ["zen", "30"],
    ["custom", "zen"],
    ["quote", "custom"],
    ["time", "015"],
    ["words", "010"],
  ] as const)("rejects an inconsistent %s setting %s", (mode, mode2) => {
    expect(getResultFailure(completedEvent({ mode, mode2 }))).toBe(
      "invalid-mode",
    );
  });
  it("validates custom time limits and requires custom settings", () => {
    expect(
      getResultFailure(completedEvent({ mode: "custom", mode2: "custom" })),
    ).toBe("invalid-mode");
    expect(
      getResultFailure(
        completedEvent({
          mode: "custom",
          mode2: "custom",
          customText: {
            mode: "random",
            textLen: 20,
            pipeDelimiter: false,
            limit: { mode: "time", value: 60 },
          },
        }),
      ),
    ).toBe("invalid-duration");
  });
  it("enforces frontend speed ceilings, with the 10-word exception", () => {
    expect(getResultFailure(completedEvent({ wpm: 351 }))).toBe("speed-limit");
    expect(
      getResultFailure(
        completedEvent({
          mode: "words",
          mode2: "10",
          wpm: 400,
          rawWpm: 400,
          charStats: [1000, 0, 0, 0],
          charTotal: 1000,
        }),
      ),
    ).toBeUndefined();
  });
  it("bounds abandoned-test credit to the supplied restart list", () => {
    expect(
      getResultFailure(
        completedEvent({
          restartCount: 1,
          incompleteTests: [{ acc: 90, seconds: 2.34 }],
          incompleteTestSeconds: 2.34,
        }),
      ),
    ).toBeUndefined();
    expect(getResultFailure(completedEvent({ restartCount: 999 }))).toBe(
      "incomplete-test-mismatch",
    );
    expect(
      getResultFailure(
        completedEvent({
          restartCount: 1,
          incompleteTests: [{ acc: 90, seconds: 900 }],
          incompleteTestSeconds: 2,
        }),
      ),
    ).toBe("incomplete-test-mismatch");
  });
  it("checks chart alignment and consistency derived from the chart", () => {
    const result = completedEvent();
    expect(
      getResultFailure({
        ...result,
        chartData: { wpm: [80], burst: [], err: [] },
      }),
    ).toBe("invalid-chart");
    expect(getResultFailure({ ...result, consistency: 1 })).toBe(
      "consistency-mismatch",
    );
    expect(getResultFailure({ ...result, wpmConsistency: 1 })).toBe(
      "consistency-mismatch",
    );
  });
  it("accepts omitted long-test telemetry but never a short-test sentinel", () => {
    expect(getResultFailure(completedEvent({ chartData: "toolong" }))).toBe(
      "invalid-chart",
    );
    expect(
      getResultFailure(
        completedEvent({
          mode2: "180",
          testDuration: 180,
          wpm: 13.33,
          rawWpm: 14.67,
          chartData: "toolong",
        }),
      ),
    ).toBeUndefined();
  });
});
