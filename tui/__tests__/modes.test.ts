import { describe, expect, test } from "bun:test";

import { key, typingTest } from "./helpers/typing-test";

describe("offline modes and restarts", () => {
  test("starts custom time and section limits through core generation", async () => {
    const { test: typing, store } = await typingTest({
      customText: {
        text: ["one two", "three four"],
        mode: "repeat",
        limit: { mode: "section", value: 2 },
        pipeDelimiter: true,
      },
    });
    store.set("mode", "custom");
    await typing.restart();
    expect(typing.status()).toBe("ready");
    expect(typing.words()).toHaveLength(4);
    expect(typing.sectionIndex()).toBe(1);
    await typing.insert(typing.words()[0] ?? "", 0);
    await typing.insert(typing.words()[1] ?? "", 1000);
    expect(typing.sectionIndex()).toBe(2);
    typing.customText.limit.mode = "time";
    typing.customText.limit.value = 15;
    await typing.restart();
    await typing.insert("o", 0);
    typing.advance(15000);
    expect(typing.status()).toBe("finished");
    expect(typing.result()?.result.customText?.limit.mode).toBe("time");
    await store.flush();
  });
  test("refills words beyond the initial buffer and ends on the final letter", async () => {
    const { test: typing, store } = await typingTest();
    store.set("mode", "words");
    store.set("words", 101);
    await typing.restart();
    expect(typing.words()).toHaveLength(100);
    let timestamp = 0;
    for (let index = 0; index < 101; index++) {
      const word = typing.words()[index];
      expect(word).toBeDefined();
      for (const char of word ?? "") {
        await typing.insert(char, timestamp);
        timestamp += 100;
      }
    }
    expect(typing.status()).toBe("finished");
    expect(typing.words()).toHaveLength(101);
    expect(typing.words().at(-1)?.endsWith(" ")).toBe(false);
    await store.flush();
  });
  test("generates every mode using bundled sources", async () => {
    const { test: typing, store } = await typingTest();
    for (const mode of ["time", "words", "quote", "custom", "zen"] as const) {
      store.set("mode", mode);
      await typing.restart();
      expect(typing.status()).toBe("ready");
      expect(typing.words().length).toBeGreaterThan(0);
      if (mode !== "zen") expect(typing.words()[0]?.length).toBeGreaterThan(0);
    }
    await typing.insert("hello world", 0);
    expect(typing.activeIndex()).toBe(1);
    expect(typing.words()).toEqual(["hello ", "world"]);
    typing.finish(16000);
    expect(typing.result()?.result.mode).toBe("zen");
    expect(typing.result()?.result.acc).toBe(100);
    await store.flush();
  });
  test("repeats words, clears input and rejects repeated results from saving", async () => {
    const { test: typing, store } = await typingTest({
      words: ["cat ", "dog"],
    });
    store.set("mode", "words");
    store.set("words", 10);
    await typing.restart();
    await typing.insert("c", 0);
    const original = typing.words();
    await typing.handleKey(key("f7"), 100);
    expect(typing.words()).toEqual(original);
    expect(typing.inputFor(0)).toBe("");
    let timestamp = 5000;
    for (const char of "cat dog") {
      await typing.insert(char, timestamp);
      timestamp += 200;
    }
    expect(typing.status()).toBe("finished");
    expect(typing.result()?.invalid).toBe("repeated");
    expect(typing.result()?.result.restartCount).toBe(1);
    await store.flush();
  });
  test("long tests require explicit restart and quote typing repeats the quote", async () => {
    const { test: typing, store } = await typingTest({ now: () => 1000 });
    store.set("time", 900);
    store.set("quickRestart", "tab");
    await typing.restart();
    await typing.insert("x", 0);
    await typing.handleKey(key("tab"), 100);
    expect(typing.status()).toBe("running");
    expect(typing.notice()).toContain("disabled in long tests");
    await typing.handleKey(key("tab", { shift: true }), 200);
    expect(typing.status()).toBe("ready");
    store.set("mode", "quote");
    store.set("repeatQuotes", "typing");
    await typing.restart();
    const quote = typing.words();
    await typing.insert("x", 1000);
    await typing.restart();
    expect(typing.words()).toEqual(quote);
    await store.flush();
  });
  test("newline and tab input retain their literal meaning", async () => {
    const { test: typing, store } = await typingTest({
      words: ["a\n", "\tb"],
      now: () => 1000,
    });
    store.set("mode", "words");
    store.set("quickRestart", "enter");
    await typing.restart();
    await typing.insert("a", 0);
    await typing.handleKey(key("return"), 100);
    expect(typing.activeIndex()).toBe(1);
    await typing.handleKey(key("tab"), 200);
    expect(typing.inputFor(1)).toBe("\t");
    await store.flush();
  });
  test("quote restarts retain repeatQuotes=off without marking the next test repeated", async () => {
    const { test: typing, store } = await typingTest({ now: () => 1000 });
    store.set("mode", "quote");
    store.set("repeatQuotes", "off");
    await typing.restart();
    await typing.insert("x", 1000);
    await typing.restart();
    let timestamp = 5000;
    for (const word of typing.words()) {
      for (const char of word) {
        await typing.insert(char, timestamp);
        timestamp += 100;
      }
    }
    expect(typing.status()).toBe("finished");
    expect(typing.result()?.invalid).not.toBe("repeated");
    await store.flush();
  });
});
