import { CompletedEventSchema } from "@oxytype/schemas/results";
import type { Config } from "@oxytype/schemas/configs";
import { z } from "zod/v3";
import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
} from "solid-js";

import { readJson, writeJson } from "../storage/json";
import type { FinishedTest, LocalResult } from "../test/typing-test";

const series = z.array(z.number().finite().nonnegative());
const localResultSchema = CompletedEventSchema.omit({
  uid: true,
  hash: true,
}).extend({
  chartData: z
    .object({ wpm: series, burst: series, err: series })
    .or(z.literal("toolong")),
  keyDuration: series.or(z.literal("toolong")),
  keySpacing: series.or(z.literal("toolong")),
});
const entrySchema = z.object({
  id: z.string().uuid(),
  result: localResultSchema,
  rawHistory: series,
});
export type HistoryEntry = {
  id: string;
  result: LocalResult;
  rawHistory: number[];
};
export type HistoryStore = {
  entries: Accessor<readonly HistoryEntry[]>;
  notice: Accessor<string | undefined>;
  lastSave: Accessor<
    { result: LocalResult; state: "saving" | "saved" | "error" } | undefined
  >;
  add: (test: FinishedTest) => Promise<boolean>;
  flush: () => Promise<void>;
};

export function createHistoryStore(
  initial: HistoryEntry[] = [],
  file?: string,
  warning?: string,
): HistoryStore {
  const [entries, setEntries] = createSignal<readonly HistoryEntry[]>(
    initial.sort((a, b) => b.result.timestamp - a.result.timestamp),
  );
  const [notice, setNotice] = createSignal<string | undefined>(warning);
  const [lastSave, setLastSave] = createSignal<{
    result: LocalResult;
    state: "saving" | "saved" | "error";
  }>();
  let pending = Promise.resolve();
  return {
    entries,
    notice,
    lastSave,
    add: async (test) => {
      if (test.invalid !== undefined || test.result.client !== "tui") {
        return false;
      }
      const parsed = entrySchema.safeParse({
        id: crypto.randomUUID(),
        result: test.result,
        rawHistory: test.rawHistory,
      });
      if (!parsed.success) {
        setNotice("Result could not be stored: invalid result data");
        setLastSave({ result: test.result, state: "error" });
        return false;
      }
      const entry = parsed.data;
      setEntries((previous) =>
        [entry, ...previous].sort(
          (a, b) => b.result.timestamp - a.result.timestamp,
        ),
      );
      setLastSave({
        result: test.result,
        state: file === undefined ? "saved" : "saving",
      });
      if (file === undefined) return true;
      const snapshot = { version: 1, entries: entries() };
      const write = async (): Promise<void> => {
        await writeJson(file, snapshot);
      };
      // A failed write must not prevent later saves from retrying.
      pending = pending.then(write, write);
      try {
        await pending;
        setNotice(undefined);
        if (lastSave()?.result === test.result) {
          setLastSave({ result: test.result, state: "saved" });
        }
        return true;
      } catch (error) {
        if (lastSave()?.result === test.result) {
          setLastSave({ result: test.result, state: "error" });
        }
        setNotice(
          error instanceof Error
            ? error.message
            : "Could not save local history",
        );
        return false;
      }
    },
    flush: async () => pending,
  };
}

export async function openHistoryStore(file: string): Promise<HistoryStore> {
  const stored = await readJson(
    file,
    z.object({ version: z.literal(1), entries: z.array(z.unknown()) }),
  );
  if (stored.status === "missing") return createHistoryStore([], file);
  if (stored.status === "invalid") {
    return createHistoryStore([], file, "Local history could not be read");
  }
  const entries: HistoryEntry[] = [];
  let skipped = 0;
  for (const value of stored.value.entries) {
    const parsed = entrySchema.safeParse(value);
    if (parsed.success && parsed.data.result.client === "tui") {
      entries.push(parsed.data);
    } else {
      skipped++;
    }
  }
  return createHistoryStore(
    entries,
    file,
    skipped > 0 ? "Skipped invalid local history entries" : undefined,
  );
}

function matchingResults(
  entries: readonly HistoryEntry[],
  config: Config,
  mode2: string,
): LocalResult[] {
  return entries
    .map((entry) => entry.result)
    .filter(
      (result) =>
        result.mode === config.mode &&
        result.mode2 === mode2 &&
        result.language === config.language &&
        result.punctuation === config.punctuation &&
        result.numbers === config.numbers &&
        result.difficulty === config.difficulty &&
        result.lazyMode === config.lazyMode &&
        result.funbox.join() === config.funbox.join(),
    );
}

export function localPaceSpeed(
  entries: readonly HistoryEntry[],
  config: Config,
  mode2: string,
  now = Date.now(),
  tags: readonly string[] = [],
): number {
  if (config.paceCaret === "off") return 0;
  if (config.paceCaret === "custom") return config.paceCaretCustomSpeed;
  const results = matchingResults(entries, config, mode2).filter(
    (result) =>
      config.paceCaret !== "tagPb" ||
      result.tags.some((id) => tags.includes(id)),
  );
  if (config.paceCaret === "last") return results[0]?.wpm ?? 0;
  if (config.paceCaret === "average") {
    const last10 = results.slice(0, 10);
    return last10.length === 0
      ? 0
      : Math.round(
          last10.reduce((sum, result) => sum + result.wpm, 0) / last10.length,
        );
  }
  const dailyCutoff = now - 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    ...results
      .filter(
        (result) =>
          config.paceCaret !== "daily" || result.timestamp >= dailyCutoff,
      )
      .map((result) => result.wpm),
  );
}

export const HistoryContext = createContext<HistoryStore>();
export function useHistory(): HistoryStore {
  const history = useContext(HistoryContext);
  if (history === undefined) {
    throw new Error("useHistory outside HistoryContext");
  }
  return history;
}
