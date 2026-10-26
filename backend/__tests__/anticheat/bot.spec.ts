import { describe, expect, it } from "vite-plus/test";
import { completedEvent } from "../__testData__/completed-event";
import { getBotFailure } from "../../src/anticheat/bot";
import type { CompletedEvent } from "@caret/schemas/results";

describe("fixed timing signature", () => {
  const fixed = (): CompletedEvent =>
    completedEvent({
      keySpacing: Array.from({ length: 219 }, () => 80),
      keyDuration: Array.from({ length: 220 }, () => 25),
    });
  it("flags long fixed-positive gap and hold sequences together", () => {
    expect(getBotFailure(fixed())).toBe("uniform-key-timing");
  });
  it("accepts varied timings, including fast/steady typists", () => {
    expect(getBotFailure(completedEvent({ wpm: 300 }))).toBeUndefined();
    const human = completedEvent();
    expect(
      getBotFailure({ ...fixed(), keySpacing: human.keySpacing }),
    ).toBeUndefined();
    expect(
      getBotFailure({ ...fixed(), keyDuration: human.keyDuration }),
    ).toBeUndefined();
  });
  it("never uses zero holds, missing keyups or coarse zero intervals as bot evidence", () => {
    expect(
      getBotFailure({
        ...fixed(),
        keyDuration: Array.from({ length: 220 }, () => 0),
      }),
    ).toBeUndefined();
    expect(
      getBotFailure({
        ...fixed(),
        keySpacing: Array.from({ length: 219 }, (_, i) => (i % 2 ? 100 : 0)),
      }),
    ).toBeUndefined();
  });
  it("does not classify short or sparse IME/mobile samples", () => {
    expect(getBotFailure({ ...fixed(), charTotal: 500 })).toBeUndefined();
    expect(
      getBotFailure(completedEvent({ keySpacing: [], keyDuration: [] })),
    ).toBeUndefined();
    expect(
      getBotFailure({
        ...fixed(),
        charTotal: 50,
        keySpacing: Array.from({ length: 50 }, () => 80),
        keyDuration: Array.from({ length: 51 }, () => 25),
      }),
    ).toBeUndefined();
  });
  it("does not let endpoint anomalies hide a fixed sequence", () => {
    const result = fixed();
    if (result.keyDuration === "toolong" || result.keySpacing === "toolong") {
      throw new Error("Missing timings");
    }
    result.keyDuration[0] = 60_000;
    result.keyDuration[result.keyDuration.length - 1] = 0;
    result.keySpacing[0] = 0;
    expect(getBotFailure(result)).toBe("uniform-key-timing");
  });
  it("accepts long-test sentinels without attempting detection", () => {
    expect(
      getBotFailure(
        completedEvent({ keySpacing: "toolong", keyDuration: "toolong" }),
      ),
    ).toBeUndefined();
  });
});
