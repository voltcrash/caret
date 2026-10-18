import { describe, expect, it } from "vite-plus/test";
import { generatedTimings, humanTimings } from "../__testData__/key-timings";
import { calibrate, extractSamples } from "../../src/anticheat/calibration";

describe("calibration report", () => {
  const human = Array.from({ length: 10 }, (_, i) => humanTimings(400, i + 1));
  const bots = Array.from({ length: 10 }, (_, i) =>
    generatedTimings(
      400,
      (random, channel) =>
        channel === "gap" ? 60 + random() * 40 : 20 + random() * 20,
      i + 1,
    ),
  );

  it("separates modelled human and uniform generator rates", () => {
    const humanReport = calibrate(human);
    expect(humanReport).toMatchObject({ samples: 10, reviewed: 10 });
    expect(humanReport.rates.any).toBe(0);
    const botReport = calibrate(bots);
    expect(botReport.rates["uniform-gaps"]).toBe(1);
    expect(botReport.rates.any).toBe(1);
    expect(botReport.features["gaps.kurtosis"]?.p95).toBeLessThan(-1);
  });
  it("counts unreviewable samples without rating them", () => {
    const report = calibrate([humanTimings(20), ...human.slice(0, 2)]);
    expect(report).toMatchObject({ samples: 3, reviewed: 2 });
    expect(calibrate([humanTimings(20)]).rates).toEqual({});
  });
  it("reads admin responses, audit rows and bare arrays", () => {
    const sample = { keySpacing: [1, 2], keyDuration: [3, 4, 5] };
    expect(
      extractSamples({ message: "ok", data: [{ message: sample }] }),
    ).toEqual([sample]);
    expect(extractSamples([{ message: sample }, sample])).toEqual([
      sample,
      sample,
    ]);
    expect(
      extractSamples([
        { keySpacing: "toolong", keyDuration: "toolong" },
        { keySpacing: [NaN], keyDuration: [1] },
        null,
      ]),
    ).toEqual([]);
    expect(extractSamples("nope")).toEqual([]);
  });
  it("reads recorded and calibration fixtures with client and labels", () => {
    const arrays = { keySpacing: [1, 2], keyDuration: [3, 4, 5] };
    expect(
      extractSamples({ completedEvent: { ...arrays, client: "web" } }),
    ).toEqual([{ ...arrays, client: "web" }]);
    expect(extractSamples({ result: { ...arrays, client: "web" } })).toEqual([
      { ...arrays, client: "web" },
    ]);
    expect(
      extractSamples({
        label: "bot",
        client: "web",
        samples: [arrays, { ...arrays, label: "model", client: "web" }],
      }),
    ).toEqual([
      { ...arrays, client: "web" },
      { ...arrays, client: "web", label: "model" },
    ]);
  });
});
