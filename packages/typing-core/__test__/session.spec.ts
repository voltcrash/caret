import { describe, it, expect } from "vite-plus/test";
import { createTestSession, SessionConfig } from "../src/session";
import { EventLog, InputEventData } from "../src/events/types";
import { loadParityCases, asJsonData } from "./fixtures";

for (const { name, fixture } of loadParityCases()) {
  it(`replays web input decisions: ${name}`, async () => {
    const log = fixture.eventLog as EventLog;
    const session = createTestSession(fixture.config as SessionConfig, {
      words: log.context.targetWords,
    });
    for (const event of log.events) {
      if (event.type === "timer") {
        if (event.data.event === "start") session.start(event.testMs);
        else if (event.data.event === "end") session.finish(event.testMs);
        else session.record("timer", event.testMs, event.data);
      } else if (event.type === "input") {
        const input = event.data;
        if (input.inputType === "insertText") {
          await session.insert(input.data, event.testMs, {
            automatic: input.automatic,
            isCompositionEnding: input.isCompositionEnding,
          });
        } else if (
          input.inputType === "deleteContentBackward" ||
          input.inputType === "deleteWordBackward"
        ) {
          session.delete(input.inputType, event.testMs);
        }
      } else {
        session.record(event.type, event.testMs, event.data);
      }
    }
    const actual = session
      .buildEventLog()
      .events.filter((event) => event.type === "input");
    expect(asJsonData(actual)).toEqual(
      log.events.filter((event) => event.type === "input"),
    );
  });
}

const config = loadParityCases()[0]?.fixture.config as SessionConfig;
function sessionConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    ...config,
    mode: "words",
    words: 2,
    difficulty: "normal",
    stopOnError: "off",
    deleteOnError: "off",
    freedomMode: false,
    confidenceMode: "off",
    quickEnd: false,
    ...overrides,
  };
}

it("builds a result from a finish listener without re-emitting finish", async () => {
  const entry = loadParityCases().find((c) => c.name === "words-10-clean");
  if (!entry) throw new Error("Missing fixture");
  const { fixture } = entry;
  const session = createTestSession(fixture.config as SessionConfig, {
    words: ["a"],
  });
  let finishes = 0;
  session.on("finish", ({ eventLog }) => {
    finishes++;
    session.complete(eventLog, {
      config: fixture.config as SessionConfig,
      currentQuote: null,
      customText: undefined,
      tags: [],
      bailedOut: false,
      restartCount: 0,
      incompleteTests: [],
      incompleteSeconds: 0,
      timestamp: 0,
    });
  });
  await session.insert("a", 0);
  expect(finishes).toBe(1);
});

describe("headless lifecycle", () => {
  it.each([
    ["hello", false],
    ["한글", true],
    ["한", true],
    ["ㄱ", true],
    ["\ua960", true],
    ["\ud7b0", true],
    ["日本語", false],
  ] as const)("records Korean status for %s", (text, expected) => {
    const session = createTestSession(sessionConfig(), { words: [text] });
    expect(session.buildEventLog().context.koreanStatus).toBe(expected);
  });

  it("emits input, word, tick, finish and resets isolated state", async () => {
    const session = createTestSession(sessionConfig(), {
      words: ["one ", "two"],
      dateNow: () => 1234,
    });
    const seen: string[] = [];
    const unsubscribe = session.on("input", () => seen.push("input"));
    session.on("word", () => seen.push("word"));
    session.on("tick", () => seen.push("tick"));
    session.on("finish", () => seen.push("finish"));
    await session.insert("one ", 0);
    session.advance(1000);
    await session.insert("two", 1100);
    expect(seen).toEqual([
      "input",
      "input",
      "input",
      "input",
      "word",
      "tick",
      "input",
      "input",
      "input",
      "finish",
    ]);
    expect(session.isActive()).toBe(false);
    unsubscribe();
    session.reset();
    expect(session.buildEventLog().events).toEqual([]);
    expect(session.getActiveWordIndex()).toBe(0);
    expect(createTestSession(sessionConfig()).buildEventLog().events).toEqual(
      [],
    );
  });

  it.each(["on", "max"] as const)(
    "enforces confidence %s",
    async (confidenceMode) => {
      const session = createTestSession(sessionConfig({ confidenceMode }), {
        words: ["one ", "two"],
      });
      await session.insert("x ", 0);
      session.delete("deleteContentBackward", 10);
      expect(session.getActiveWordIndex()).toBe(1);
      expect(session.recorder.getCurrentInput()).toBe("");
    },
  );

  it("freedom mode permits correcting an earlier completed word", async () => {
    const session = createTestSession(sessionConfig({ freedomMode: true }), {
      words: ["one ", "two"],
    });
    await session.insert("one ", 0);
    session.delete("deleteContentBackward", 10);
    expect(session.getActiveWordIndex()).toBe(0);
    expect(session.recorder.getCurrentInput()).toBe("one");
  });

  it.each(["letter", "letter_hard", "word", "word_hard"] as const)(
    "deletes errors in %s mode",
    async (deleteOnError) => {
      const session = createTestSession(sessionConfig({ deleteOnError }), {
        words: ["one ", "two"],
      });
      await session.insert("ox", 0);
      expect(session.recorder.getCurrentInput()).toBe("");
      expect(
        session.buildEventLog().events.filter((event) => event.type === "input")
          .length,
      ).toBe(deleteOnError.startsWith("word") ? 3 : 4);
    },
  );

  it("stops on the first error in master difficulty", async () => {
    const session = createTestSession(sessionConfig({ difficulty: "master" }), {
      words: ["one ", "two"],
    });
    let reason: string | undefined;
    session.on("finish", (event) => {
      reason = event.reason;
    });
    await session.insert("x", 0);
    expect(reason).toBe("difficulty");
    expect(session.isActive()).toBe(false);
  });

  it("auto-indents code without requiring a keypress", async () => {
    const session = createTestSession(
      sessionConfig({ language: "code_javascript" }),
      { words: ["one\n", "\t\ttwo"] },
    );
    await session.insert("one\n", 0);
    const automatic = session
      .buildEventLog()
      .events.filter((event) => event.type === "input" && event.data.automatic);
    expect(
      automatic.map((event) => (event.data as InputEventData).inputValue),
    ).toEqual(["\t", "\t\t"]);
  });
});
