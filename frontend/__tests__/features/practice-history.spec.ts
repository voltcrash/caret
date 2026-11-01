import { expect, it } from "vite-plus/test";
import { updatePracticeHistory } from "../../src/features/typing/practice-history.client";

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
