import type { CompletedEvent } from "@caret/schemas/results";
import { kogasa, mean, roundTo2, stdDev } from "@caret/util/numbers";

/** A consistent 30-second, 80-WPM payload, with varied key timings. */
export function completedEvent(
  overrides: Partial<CompletedEvent> = {},
): CompletedEvent {
  const keySpacing = Array.from({ length: 219 }, (_, i) => 110 + (i % 7) * 5);
  const keyDuration = Array.from({ length: 220 }, (_, i) => 40 + (i % 5) * 7);
  const wpm = Array.from({ length: 30 }, (_, i) => 75 + (i % 11));
  const burst = Array.from({ length: 30 }, (_, i) => 72 + (i % 9) * 4);
  const consistency = (values: number[]): number =>
    roundTo2(kogasa(stdDev(values) / mean(values)));
  return {
    client: "web",
    uid: "anticheat-user",
    hash: "hash",
    timestamp: 1000,
    mode: "time",
    mode2: "30",
    language: "english",
    difficulty: "normal",
    wpm: 80,
    rawWpm: 88,
    acc: 95,
    charStats: [200, 10, 5, 3],
    charTotal: 220,
    testDuration: 30,
    afkDuration: 0,
    bailedOut: false,
    blindMode: false,
    lazyMode: false,
    stopOnLetter: false,
    punctuation: false,
    numbers: false,
    funbox: [],
    tags: [],
    restartCount: 0,
    incompleteTestSeconds: 0,
    incompleteTests: [],
    chartData: { wpm, burst, err: Array.from({ length: 30 }, () => 0) },
    consistency: consistency(burst),
    wpmConsistency: consistency(wpm),
    keySpacing,
    keyDuration,
    keyConsistency: consistency(keySpacing.slice(0, -1)),
    startToFirstKey: 0,
    lastKeyToEnd: 30_000 - keySpacing.reduce((sum, value) => sum + value, 0),
    keyOverlap: 50,
    ...overrides,
  };
}
