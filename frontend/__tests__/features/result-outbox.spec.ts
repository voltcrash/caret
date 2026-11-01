import { expect, it } from "vite-plus/test";
import {
  createResultOutbox,
  createOutboxStorage,
  type PendingResult,
} from "../../src/features/typing/result-outbox.client";
import type { CompletedEvent } from "@caret/schemas/results";

it("keeps unrelated pending results from another tab and isolates actors", async () => {
  const actor = `outbox-${crypto.randomUUID()}`;
  const first = createResultOutbox(createOutboxStorage(actor));
  const second = createResultOutbox(createOutboxStorage(actor));
  await Promise.all([first.load(), second.load()]);
  await Promise.all([
    first.add({ result: { hash: "a" } as CompletedEvent }),
    second.add({ result: { hash: "b" } as CompletedEvent }),
  ]);
  await first.remove("a");
  const reloaded = createResultOutbox(createOutboxStorage(actor));
  await reloaded.load();
  expect(reloaded.entries().map((entry) => entry.result.hash)).toEqual(["b"]);
  const other = createResultOutbox(createOutboxStorage(`${actor}-other`));
  await other.load();
  expect(other.entries()).toEqual([]);
  await reloaded.clear();
});

it("retains memory entries and retries a failed read without overwriting older pending work", async () => {
  let readable = false;
  let disk: PendingResult[] = [{ result: { hash: "old" } as CompletedEvent }];
  const queue = createResultOutbox({
    read: async () => {
      if (!readable) throw new Error("unavailable");
      return structuredClone(disk);
    },
    write: async (entries) => {
      disk = structuredClone(entries);
    },
  });
  await expect(
    queue.add({ result: { hash: "new" } as CompletedEvent }),
  ).rejects.toThrow("unavailable");
  expect(disk.map((entry) => entry.result.hash)).toEqual(["old"]);
  readable = true;
  await queue.add({ result: { hash: "new" } as CompletedEvent });
  expect(disk.map((entry) => entry.result.hash)).toEqual(["old", "new"]);
});

it("retains multiple failed results across reload and removes only acknowledged results", async () => {
  let disk: PendingResult[] = [];
  const storage = {
    read: async () => structuredClone(disk),
    write: async (entries: PendingResult[]) => {
      disk = structuredClone(entries);
    },
  };
  const first = createResultOutbox(storage);
  await Promise.all([
    first.add({ result: { hash: "one" } as CompletedEvent }),
    first.add({ result: { hash: "two" } as CompletedEvent }),
  ]);
  const reloaded = createResultOutbox(storage);
  await reloaded.load();
  expect(reloaded.entries().map((entry) => entry.result.hash)).toEqual([
    "one",
    "two",
  ]);
  await reloaded.remove("one");
  expect(disk.map((entry) => entry.result.hash)).toEqual(["two"]);
  await reloaded.clear();
  expect(disk).toEqual([]);
});
