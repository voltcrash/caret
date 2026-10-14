import {
  CompletedEventSchema,
  type CompletedEvent,
} from "@oxytype/schemas/results";
import { createSignal, type Accessor } from "solid-js";
import { z } from "zod";

import { readJson, writeJson } from "../storage/json";

const entrySchema = z
  .object({
    id: z.guid(),
    apiUrl: z.url(),
    result: CompletedEventSchema,
    state: z.enum(["pending", "rejected"]),
    error: z.string().optional(),
  })
  .refine(
    (entry) => entry.result.client === "tui" && entry.result.offline === true,
  );
export type QueueEntry = z.infer<typeof entrySchema>;
export type UploadQueue = {
  entries: Accessor<readonly QueueEntry[]>;
  notice: Accessor<string | undefined>;
  add: (apiUrl: string, result: CompletedEvent) => Promise<QueueEntry>;
  remove: (id: string) => Promise<void>;
  reject: (id: string, error: string) => Promise<void>;
  expire: (now?: number) => Promise<void>;
  flush: () => Promise<void>;
};
export const maxUploadAge = 30 * 86400_000;

export function createUploadQueue(
  initial: QueueEntry[] = [],
  file?: string,
  warning?: string,
): UploadQueue {
  const [entries, setEntries] = createSignal<readonly QueueEntry[]>(initial);
  const [notice, setNotice] = createSignal(warning);
  let pending = Promise.resolve();
  async function save(next: readonly QueueEntry[]): Promise<void> {
    setEntries(next);
    if (file === undefined) return;
    const write = async (): Promise<void> =>
      writeJson(file, { version: 1, entries: next }, { mode: 0o600 });
    pending = pending.then(write, write);
    await pending;
  }
  return {
    entries,
    notice,
    add: async (apiUrl, result) => {
      const entry = entrySchema.parse({
        id: crypto.randomUUID(),
        apiUrl,
        result,
        state: "pending",
      });
      await save([...entries(), entry]);
      return entry;
    },
    remove: async (id) => save(entries().filter((entry) => entry.id !== id)),
    reject: async (id, error) =>
      save(
        entries().map((entry) =>
          entry.id === id ? { ...entry, state: "rejected", error } : entry,
        ),
      ),
    expire: async (now = Date.now()) => {
      const next = entries().filter(
        (entry) => entry.result.timestamp >= now - maxUploadAge,
      );
      const dropped = entries().length - next.length;
      if (dropped === 0) return;
      await save(next);
      setNotice(
        `${dropped} upload(s) older than 30 days dropped; local history retained`,
      );
    },
    flush: async () => pending,
  };
}

export async function openUploadQueue(file: string): Promise<UploadQueue> {
  const stored = await readJson(
    file,
    z.object({ version: z.literal(1), entries: z.array(z.unknown()) }),
  );
  if (stored.status !== "ok") {
    return createUploadQueue(
      [],
      file,
      stored.status === "invalid"
        ? "Upload queue could not be read"
        : undefined,
    );
  }
  const entries: QueueEntry[] = [];
  for (const value of stored.value.entries) {
    const parsed = entrySchema.safeParse(value);
    if (parsed.success) entries.push(parsed.data);
  }
  return createUploadQueue(
    entries,
    file,
    entries.length !== stored.value.entries.length
      ? "Skipped invalid queued uploads"
      : undefined,
  );
}
