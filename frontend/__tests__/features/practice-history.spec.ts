import { expect, it } from "vite-plus/test";
import {
  type PracticeWord,
  practiceHistory,
  updatePracticeHistory,
} from "../../src/features/typing/practice-history.client";

it("retains frequently seen correct words when the model reaches capacity", () => {
  const initial = {
    words: Array.from({ length: 200 }, (_, index) => ({
      word: `word${index}`,
      context: "english:qwerty",
      seen: index + 1,
      misses: 0,
      burst: 80,
    })),
    day: "today",
    seconds: 0,
    goalMinutes: 5,
  };
  const next = updatePracticeHistory(
    initial,
    "english:qwerty",
    ["new"],
    {},
    [80],
    1,
    "today",
  );
  expect(next.words).toHaveLength(200);
  expect(next.words[0]).toMatchObject({ word: "word199", seen: 200 });
});

it("retains weaknesses by language/layout and credits practice without repeating a word's test errors", () => {
  const initial = { words: [], day: "yesterday", seconds: 100, goalMinutes: 5 };
  const next = updatePracticeHistory(
    initial,
    "english:qwerty",
    ["one", "one", "two"],
    { one: 1 },
    [50, 60, 90],
    60,
    "today",
  );
  expect(next.seconds).toBe(60);
  expect(next.words.find((word) => word.word === "one")).toMatchObject({
    seen: 2,
    misses: 1,
  });
  const improved = updatePracticeHistory(
    next,
    "english:qwerty",
    ["one"],
    {},
    [80],
    30,
    "today",
  );
  expect(improved.words.find((word) => word.word === "one")).toMatchObject({
    seen: 3,
    misses: 1,
  });
  const other = updatePracticeHistory(
    improved,
    "english:dvorak",
    ["one"],
    {},
    [10],
    30,
    "today",
  );
  expect(other.words.filter((word) => word.word === "one")).toHaveLength(2);
  expect(other.seconds).toBe(120);
});

it("ranks legacy misses by evidence and retires weaknesses after clean attempts", () => {
  const context = "english:qwerty";
  const key = "caret-practice-v1:guest";
  const word = (word: string, seen: number, misses: number): PracticeWord => ({
    word,
    context,
    seen,
    misses,
    burst: 80,
  });
  localStorage.setItem(
    key,
    JSON.stringify({
      words: [
        word("rare", 1, 2),
        word("persistent", 9, 4),
        word("clean", 10, 0),
      ],
      day: "yesterday",
      seconds: 90,
      goalMinutes: 12,
    }),
  );
  const history = practiceHistory();
  const ranked = (): string[] =>
    history.weakest(context).map((entry) => entry.word);
  expect(ranked()).toEqual(["persistent", "rare"]);
  expect(history.history().goalMinutes).toBe(12);

  history.record(context, ["persistent"], {}, [], 1);
  expect(ranked()).toEqual(["rare", "persistent"]);
  history.record(context, ["persistent", "persistent"], {}, [], 1);
  expect(ranked()).toEqual(["rare"]);
  expect(
    history.history().words.find((entry) => entry.word === "persistent"),
  ).toMatchObject({ seen: 12, misses: 4 });

  // The test-level miss could belong to any of the repeated occurrences.
  history.record(
    context,
    Array<string>(4).fill("persistent"),
    { persistent: 1 },
    [],
    1,
  );
  expect(ranked()).toContain("persistent");
});
