import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  createHistoryStore,
  localPaceSpeed,
  openHistoryStore,
} from "../src/results/history";
import { writeJson } from "../src/storage/json";
import { typingTest } from "./helpers/typing-test";
import { tempDir } from "./helpers/temp-dir";

async function finishedTest(): Promise<
  NonNullable<
    ReturnType<Awaited<ReturnType<typeof typingTest>>["test"]["result"]>
  >
> {
  const words = "the quick brown fox jumps over the lazy dog again"
    .split(" ")
    .map((word, index) => word + (index === 9 ? "" : " "));
  const { test: typing, store } = await typingTest({ words });
  store.set("mode", "words");
  store.set("words", 10);
  await typing.restart();
  let now = 0;
  for (const char of words.join("")) {
    await typing.insert(char, now);
    now += 200;
  }
  await store.flush();
  const finished = typing.result();
  if (finished === undefined) throw new Error("Test did not finish");
  return finished;
}

describe("local result history", () => {
  test("daily pace includes the previous evening after midnight", async () => {
    const now = new Date(2026, 9, 11, 0, 30).getTime();
    const history = createHistoryStore();
    const finished = await finishedTest();
    await history.add({
      ...finished,
      result: { ...finished.result, wpm: 80, timestamp: now - 3600_000 },
    });
    const { store } = await typingTest();
    store.set("mode", "words");
    store.set("words", 10);
    store.set("paceCaret", "daily");
    expect(localPaceSpeed(history.entries(), store.config, "10", now)).toBe(80);
    await store.flush();
  });
  test("daily pace includes the 24-hour boundary and excludes older results", async () => {
    const now = new Date(2026, 9, 11, 12).getTime();
    const history = createHistoryStore();
    const finished = await finishedTest();
    await history.add({
      ...finished,
      result: { ...finished.result, wpm: 80, timestamp: now - 24 * 3600_000 },
    });
    await history.add({
      ...finished,
      result: {
        ...finished.result,
        wpm: 200,
        timestamp: now - 24 * 3600_000 - 1,
      },
    });
    const { store } = await typingTest();
    store.set("mode", "words");
    store.set("words", 10);
    store.set("paceCaret", "pb");
    expect(localPaceSpeed(history.entries(), store.config, "10", now)).toBe(
      200,
    );
    store.set("paceCaret", "daily");
    expect(localPaceSpeed(history.entries(), store.config, "10", now)).toBe(80);
    await store.flush();
  });
  test("reports a failed disk save and rejects schema-invalid result data", async () => {
    const directory = await tempDir();
    const blocked = join(directory, "blocked");
    await writeJson(blocked, {});
    const history = createHistoryStore([], join(blocked, "history.json"));
    const finished = await finishedTest();
    expect(await history.add(finished)).toBe(false);
    expect(history.lastSave()?.state).toBe("error");
    expect(history.notice()).toBeDefined();
    const empty = createHistoryStore();
    expect(
      await empty.add({
        ...finished,
        result: { ...finished.result, wpm: 500 },
      }),
    ).toBe(false);
    expect(empty.entries()).toHaveLength(0);
  });
  test("survives a restart with core metrics and charts intact", async () => {
    const file = join(await tempDir(), "history.json");
    const history = await openHistoryStore(file);
    const finished = await finishedTest();
    expect(finished.invalid).toBeUndefined();
    expect(await history.add(finished)).toBe(true);
    await history.flush();
    const reopened = await openHistoryStore(file);
    expect(reopened.entries()[0]?.result).toEqual(finished.result);
    expect(reopened.entries()[0]?.rawHistory).toEqual(finished.rawHistory);
  });
  test("skips invalid results and repairs individual malformed stored entries", async () => {
    const file = join(await tempDir(), "history.json");
    const history = await openHistoryStore(file);
    const finished = await finishedTest();
    expect(await history.add({ ...finished, invalid: "repeated" })).toBe(false);
    await history.add(finished);
    await writeJson(file, {
      version: 1,
      entries: [...history.entries(), { broken: true }],
    });
    const reopened = await openHistoryStore(file);
    expect(reopened.entries()).toHaveLength(1);
    expect(reopened.notice()).toContain("Skipped invalid");
  });
  test("PB and average pace only use matching local tests", async () => {
    const history = await openHistoryStore(
      join(await tempDir(), "history.json"),
    );
    const finished = await finishedTest();
    await history.add({
      ...finished,
      result: { ...finished.result, wpm: 60, timestamp: 1000 },
    });
    await history.add({
      ...finished,
      result: { ...finished.result, wpm: 100, timestamp: 2000 },
    });
    await history.add({
      ...finished,
      result: { ...finished.result, wpm: 300, mode2: "25", timestamp: 3000 },
    });
    const { store } = await typingTest();
    store.set("mode", "words");
    store.set("words", 10);
    store.set("paceCaret", "pb");
    expect(localPaceSpeed(history.entries(), store.config, "10")).toBe(100);
    store.set("paceCaret", "average");
    expect(localPaceSpeed(history.entries(), store.config, "10")).toBe(80);
    store.set("paceCaret", "custom");
    store.set("paceCaretCustomSpeed", 77);
    expect(localPaceSpeed([], store.config, "10")).toBe(77);
    await store.flush();
  });
});
