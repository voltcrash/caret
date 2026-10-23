/**
 * Writes the synthetic anticheat calibration fixtures.
 *
 * Bots mimic the generators the detectors target: fixed intervals, jitter,
 * bounded random ranges, hardcoded delay pools, memoryless draws and replayed
 * recordings. "model" fixtures come from a rough hand model (one drifting speed
 * state drives gaps and holds); they are not human samples. Run, then format:
 *
 *   vp exec node packages/typing-core/scripts/record-bot-fixtures.ts
 *   vp fmt packages/typing-core/__fixtures__/anticheat
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mulberry32, scriptedKey, type Rng } from "./lib/keystroke-plan.ts";

type Timeline = {
  keySpacing: number[];
  keyDuration: number[];
  // overrides the fixture label for one sample
  label?: "model";
};
type Fixture = {
  name: string;
  label: "bot" | "model";
  client: "web";
  description: string;
  samples: Timeline[];
};

const KEYS = 320;

const round = (value: number, places = 2): number =>
  Math.round(value * 10 ** places) / 10 ** places;

function normal(rng: Rng): number {
  // Box-Muller; keep away from log(0)
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function timeline(
  seed: number,
  gap: (rng: Rng, index: number) => number,
  hold: (rng: Rng, index: number) => number,
  places = 2,
): Timeline {
  const rng = mulberry32(seed);
  return {
    keySpacing: Array.from({ length: KEYS - 1 }, (_, i) =>
      round(gap(rng, i), places),
    ),
    keyDuration: Array.from({ length: KEYS }, (_, i) =>
      round(hold(rng, i), places),
    ),
  };
}

/** One log-speed state drifts (AR(1)) and drives both channels, with pauses. */
function modelHand(seed: number, msPerKey: number, places = 1): Timeline {
  const rng = mulberry32(seed);
  const keySpacing: number[] = [];
  const keyDuration: number[] = [];
  let speed = 0;
  for (let i = 0; i < KEYS; i++) {
    speed = 0.8 * speed + 0.2 * normal(rng);
    const pause = rng() < 0.03 ? 400 + 600 * rng() : 0;
    const gap = msPerKey * Math.exp(0.5 * speed + 0.25 * normal(rng)) + pause;
    keyDuration.push(
      round(0.9 * msPerKey * Math.exp(0.4 * speed + 0.2 * normal(rng)), places),
    );
    if (i < KEYS - 1) keySpacing.push(round(gap, places));
  }
  return { keySpacing, keyDuration };
}

const pick = <T>(rng: Rng, values: readonly T[]): T =>
  values[Math.floor(rng() * values.length)] as T;

const recorded = modelHand(41, 85);

const fixtures: Fixture[] = [
  {
    name: "fixed-interval",
    label: "bot",
    client: "web",
    description: "Every gap 80 ms and every hold 45 ms.",
    samples: [
      timeline(
        1,
        () => 80,
        () => 45,
      ),
    ],
  },
  {
    name: "sub-ms-jitter",
    label: "bot",
    client: "web",
    description:
      "80/45 ms with jitter inside the 0.01 ms fixed-timing tolerance.",
    samples: [
      timeline(
        3,
        (rng) => 80 + (rng() - 0.5) * 0.008,
        (rng) => 45 + (rng() - 0.5) * 0.008,
        3,
      ),
    ],
  },
  {
    name: "ms-jitter",
    label: "bot",
    client: "web",
    description:
      "80/45 ms with ±1 ms uniform jitter, escaping the exact check.",
    samples: [
      timeline(
        4,
        (rng) => 79 + rng() * 2,
        (rng) => 44 + rng() * 2,
      ),
    ],
  },
  {
    name: "uniform-range",
    label: "bot",
    client: "web",
    description: "Independent uniform gaps 60-100 ms and holds 20-40 ms.",
    samples: [
      timeline(
        5,
        (rng) => 60 + rng() * 40,
        (rng) => 20 + rng() * 20,
      ),
    ],
  },
  {
    name: "scripted-playwright",
    label: "bot",
    client: "web",
    description:
      "The fast scripted presses record-fixtures.ts sends: uniform 60-120 ms gaps and 40-150 ms holds.",
    samples: [
      (() => {
        const rng = mulberry32(6);
        const keys = Array.from({ length: KEYS }, () =>
          scriptedKey(rng, "a", true),
        );
        return {
          keySpacing: keys
            .slice(1)
            .map((key) => (key.kind === "key" ? key.gap : 0)),
          keyDuration: keys.map((key) => (key.kind === "key" ? key.hold : 0)),
        };
      })(),
    ],
  },
  {
    name: "value-pool",
    label: "bot",
    client: "web",
    description: "Delays drawn from small hardcoded pools.",
    samples: [
      timeline(
        7,
        (rng) => pick(rng, [73, 81, 88, 95, 104]),
        (rng) => pick(rng, [41, 47, 52]),
      ),
    ],
  },
  {
    name: "independent-gaussian",
    label: "bot",
    client: "web",
    description: "Independent normal gaps (85±18 ms) and holds (45±9 ms).",
    samples: [
      timeline(
        8,
        (rng) => Math.max(20, 85 + 18 * normal(rng)),
        (rng) => Math.max(10, 45 + 9 * normal(rng)),
      ),
    ],
  },
  {
    name: "independent-lognormal",
    label: "bot",
    client: "web",
    description:
      "Human-shaped lognormal gaps and holds, but every draw independent.",
    samples: [
      timeline(
        9,
        (rng) => 80 * Math.exp(0.3 * normal(rng)),
        (rng) => 70 * Math.exp(0.2 * normal(rng)),
      ),
    ],
  },
  {
    name: "replayed-recording",
    label: "bot",
    client: "web",
    description:
      "One modelled timeline uploaded by the same user, resubmitted exactly and then with ±0.3 ms noise.",
    samples: [
      // the first upload is ordinary typing; only the resubmissions are bots
      { ...recorded, label: "model" },
      recorded,
      (() => {
        const rng = mulberry32(10);
        const noisy = (value: number): number =>
          round(value + (rng() - 0.5) * 0.6);
        return {
          keySpacing: recorded.keySpacing.map(noisy),
          keyDuration: recorded.keyDuration.map(noisy),
        };
      })(),
    ],
  },
  {
    name: "model-hand",
    label: "model",
    client: "web",
    description:
      "Three modelled hands at 70, 85 and 100 ms per key with 0.1 ms timestamps.",
    samples: [modelHand(11, 70), modelHand(12, 85), modelHand(13, 100)],
  },
  {
    name: "model-hand-coarse-clock",
    label: "model",
    client: "web",
    description: "Modelled hands on a 1 ms clock, as some browsers coarsen it.",
    samples: [modelHand(14, 80, 0), modelHand(15, 95, 0)],
  },
];

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../__fixtures__/anticheat",
);
mkdirSync(outDir, { recursive: true });
for (const fixture of fixtures) {
  writeFileSync(
    join(outDir, `${fixture.name}.json`),
    `${JSON.stringify(fixture, null, 2)}\n`,
  );
}
console.log(`wrote ${fixtures.length} fixtures to ${outDir}`);
