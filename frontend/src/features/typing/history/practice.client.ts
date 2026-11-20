import { z } from "zod";
import { createSignal } from "solid-js";
import { createAccountOwned, captureAccount } from "#app/account-scope.ts";
import { LocalStorageWithSchema } from "#shared/utils/local-storage-with-schema.ts";

const cleanAttemptsToRetire = 3;
const priorCleanAttempts = 4;

const wordSchema = z.object({
  word: z.string().max(80),
  context: z.string().max(200),
  seen: z.number().int().positive(),
  misses: z.number().int().nonnegative(),
  cleanStreak: z.number().int().nonnegative().optional(),
  burst: z.number().nonnegative(),
});
const historySchema = z.object({
  words: z.array(wordSchema).max(200),
  day: z.string(),
  seconds: z.number().nonnegative(),
  goalMinutes: z.number().int().min(1).max(30),
});
type History = z.infer<typeof historySchema>;
export type PracticeWord = z.infer<typeof wordSchema>;

function weakness(word: PracticeWord): number {
  const streak = word.cleanStreak ?? 0;
  if (streak >= cleanAttemptsToRetire) return 0;
  // A single attempt can contribute several incorrect keystrokes.
  const cappedMisses = Math.min(word.misses, word.seen);
  return cappedMisses / (word.seen + priorCleanAttempts) / (1 + streak);
}

export function updatePracticeHistory(
  history: History,
  context: string,
  words: string[],
  misses: Record<string, number>,
  bursts: number[],
  seconds: number,
  day: string,
): History {
  const model = new Map(
    history.words.map((entry) => [
      `${entry.context}\0${entry.word}`,
      { ...entry },
    ]),
  );
  const creditedMisses = new Set<string>();
  for (const [index, word] of words.entries()) {
    if (word.length === 0 || word.length > 80) continue;
    const key = `${context}\0${word}`;
    const previous = model.get(key);
    const burst = bursts[index];
    const testMisses = Object.hasOwn(misses, word) ? (misses[word] ?? 0) : 0;
    model.set(key, {
      word,
      context,
      seen: (previous?.seen ?? 0) + 1,
      misses:
        (previous?.misses ?? 0) + (creditedMisses.has(word) ? 0 : testMisses),
      // Misses are aggregated per word, so a mixed test cannot establish a clean streak.
      cleanStreak:
        testMisses > 0
          ? 0
          : Math.min(cleanAttemptsToRetire, (previous?.cleanStreak ?? 0) + 1),
      burst:
        burst !== undefined && Number.isFinite(burst)
          ? previous === undefined
            ? burst
            : previous.burst * 0.75 + burst * 0.25
          : (previous?.burst ?? 0),
    });
    if (testMisses > 0) creditedMisses.add(word);
  }
  return {
    ...history,
    words: [...model.values()]
      .sort((a, b) => weakness(b) - weakness(a) || b.seen - a.seen)
      .slice(0, 200),
    day,
    seconds: (history.day === day ? history.seconds : 0) + Math.max(0, seconds),
  };
}

export const practiceHistory = createAccountOwned(() => {
  const actor = captureAccount().actor ?? "guest";
  const storage = new LocalStorageWithSchema({
    key: `caret-practice-v1:${actor}`,
    schema: historySchema,
    fallback: { words: [], day: "", seconds: 0, goalMinutes: 5 },
  });
  const [history, setHistory] = createSignal(storage.get());
  const save = (next: History): void => {
    storage.set(next);
    setHistory(next);
  };
  return {
    history,
    record: (
      context: string,
      words: string[],
      misses: Record<string, number>,
      bursts: number[],
      seconds: number,
    ): void => {
      save(
        updatePracticeHistory(
          history(),
          context,
          words,
          misses,
          bursts,
          seconds,
          new Date().toLocaleDateString("en-CA"),
        ),
      );
    },
    weakest: (context: string): PracticeWord[] =>
      history()
        .words.filter((word) => word.context === context && weakness(word) > 0)
        .sort((a, b) => weakness(b) - weakness(a) || a.burst - b.burst)
        .slice(0, 20),
    setGoal: (minutes: number): void => {
      save({
        ...history(),
        goalMinutes: Math.min(30, Math.max(1, Math.round(minutes))),
      });
    },
    clear: (): void => {
      save({
        words: [],
        day: "",
        seconds: 0,
        goalMinutes: history().goalMinutes,
      });
    },
  };
});
