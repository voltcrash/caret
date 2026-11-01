import { z } from "zod";
import { createSignal } from "solid-js";
import { createAccountOwned, captureAccount } from "../../app/account-scope";
import { LocalStorageWithSchema } from "../../ts/utils/local-storage-with-schema";

const wordSchema = z.object({
  word: z.string().max(80),
  context: z.string().max(200),
  seen: z.number().int().positive(),
  misses: z.number().int().nonnegative(),
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
  for (const [index, word] of words.entries()) {
    if (word.length === 0 || word.length > 80) continue;
    const key = `${context}\0${word}`;
    const previous = model.get(key);
    const burst = bursts[index];
    model.set(key, {
      word,
      context,
      seen: (previous?.seen ?? 0) + 1,
      misses: (previous?.misses ?? 0) + (misses[word] ?? 0),
      burst:
        burst !== undefined && Number.isFinite(burst)
          ? previous === undefined
            ? burst
            : previous.burst * 0.75 + burst * 0.25
          : (previous?.burst ?? 0),
    });
    // A word's error count belongs to this test, not each repeated occurrence.
    misses = { ...misses, [word]: 0 };
  }
  return {
    ...history,
    words: [...model.values()]
      .sort((a, b) => b.misses / b.seen - a.misses / a.seen || b.seen - a.seen)
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
        .words.filter((word) => word.context === context)
        .sort(
          (a, b) => b.misses / b.seen - a.misses / a.seen || a.burst - b.burst,
        )
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
