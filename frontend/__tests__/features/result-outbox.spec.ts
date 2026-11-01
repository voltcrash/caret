import { expect, it } from "vite-plus/test";
import {
  createResultOutbox,
  type PendingResult,
} from "../../src/features/typing/result-outbox.client";
import type { CompletedEvent } from "@caret/schemas/results";

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
