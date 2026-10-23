import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { generatedTimings, humanTimings } from "../__testData__/key-timings";
import {
  extractSamples,
  type TimingSample,
} from "../../src/anticheat/calibration";
import {
  calibrateDetectors,
  detect,
  labelKind,
} from "../../src/anticheat/detectors";

const fixtures = resolve(
  __dirname,
  "../../../packages/typing-fixtures/reference",
);

function load(path: string): TimingSample[] {
  return extractSamples(JSON.parse(readFileSync(path, "utf8")) as unknown);
}

function flagged(name: string): string[][] {
  return detect(load(join(fixtures, "anticheat", `${name}.json`))).map(
    (verdict) => verdict.flagged,
  );
}

describe("synthetic bot fixtures", () => {
  it.each([
    ["fixed-interval", "fixed-timing"],
    ["sub-ms-jitter", "fixed-timing"],
    ["ms-jitter", "low-gap-variation"],
    ["uniform-range", "uniform-gaps"],
    ["scripted-playwright", "uniform-gaps"],
    ["value-pool", "small-value-pool"],
    ["independent-gaussian", "memoryless-timing"],
    ["independent-lognormal", "memoryless-timing"],
  ])("%s raises %s", (name, detector) => {
    expect(flagged(name)[0]).toContain(detector);
  });

  it("catches an exact resubmission but not one with sub-ms noise", () => {
    expect(flagged("replayed-recording")).toEqual([
      [],
      ["replayed-timing"],
      [],
    ]);
  });

  it("raises nothing on most modelled hands", () => {
    expect(flagged("model-hand")).toEqual([[], [], []]);
  });
});

describe("recorded fixtures", () => {
  it("are too short for any detector but replay", () => {
    const dir = join(fixtures, "keystrokes");
    const samples = readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => load(join(dir, name)));
    expect(samples).toHaveLength(8);
    for (const verdict of detect(samples)) {
      expect(verdict.flagged).toEqual([]);
      expect(verdict.applicable.filter((d) => d !== "replayed-timing")).toEqual(
        [],
      );
    }
  });
});

describe("detector histories", () => {
  it("keeps replays within one user and the retained history", () => {
    const first = humanTimings(400, 1);
    const samples = [first, humanTimings(400, 2), humanTimings(400, 3)];
    expect(detect([...samples, first], 2)[3]?.flagged).not.toContain(
      "replayed-timing",
    );
    expect(detect([first, first])[1]?.flagged).toContain("replayed-timing");
    expect(detect([first, first], 0)[1]?.flagged).not.toContain(
      "replayed-timing",
    );
    const report = calibrateDetectors(
      new Map([
        ["human:a", [first]],
        ["human:b", [first]],
      ]),
      () => "human",
    );
    expect(report.falsePositiveRate["replayed-timing"]).toBe(0);
  });

  it("requires hold telemetry for fixed timing", () => {
    const keySpacing = Array<number>(150).fill(80);
    const result = detect([{ keySpacing, keyDuration: [], client: "web" }])[0];
    expect(result?.applicable).not.toContain("fixed-timing");
    expect(result?.applicable).not.toContain("uniform-holds");
    expect(result?.applicable).not.toContain("low-hold-variation");
    expect(result?.applicable).not.toContain("memoryless-timing");
  });

  it("reports unmeasured human rates as null", () => {
    const report = calibrateDetectors(new Map());
    expect(Object.values(report.falsePositiveRate)).toEqual(
      Array(9).fill(null),
    );
    expect(Object.values(report.falseNegativeRate)).toEqual(
      Array(9).fill(null),
    );
  });
});

describe("detector calibration", () => {
  const human = Array.from({ length: 4 }, (_, i) => humanTimings(400, i + 1));
  const recording = humanTimings(400, 9);
  const uniform = (seed: number): TimingSample =>
    generatedTimings(
      400,
      (random, channel) =>
        channel === "gap" ? 60 + random() * 40 : 20 + random() * 20,
      seed,
    );

  it("reports false positives on human labels and misses on bot labels", () => {
    const report = calibrateDetectors(
      new Map([
        ["human-web", human],
        ["bot-uniform", [uniform(1), uniform(2)]],
        ["bot-replay", [{ ...recording, label: "human-web" }, recording]],
      ]),
    );
    expect(report.labels["human-web"]).toMatchObject({
      kind: "human",
      samples: 5,
    });
    expect(report.falsePositiveRate.any).toBe(0);
    expect(report.falsePositiveRate["fixed-timing"]).toBe(0);
    expect(report.labels["bot-uniform"]?.detectors["uniform-gaps"].rate).toBe(
      1,
    );
    expect(report.falseNegativeRate["replayed-timing"]).toBeCloseTo(2 / 3);
    expect(report.falseNegativeRate.any).toBe(0);
  });

  it("groups one user's history under a shared label", () => {
    const report = calibrateDetectors(
      new Map([
        ["bot:a", [uniform(3)]],
        ["bot:b", [uniform(4)]],
      ]),
      (key) => key.split(":")[0] ?? key,
    );
    expect(report.labels["bot"]?.samples).toBe(2);
  });

  it.each([
    ["human-reviewed", "human"],
    ["bot", "bot"],
    ["model", "other"],
  ] as const)("treats %s as %s", (label, kind) => {
    expect(labelKind(label)).toBe(kind);
  });
});
