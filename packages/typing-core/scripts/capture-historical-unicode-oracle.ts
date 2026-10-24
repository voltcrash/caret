import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTestSession } from "../src/session";
import { getDefaultConfig } from "../src/config/default-config";
import type { EventLog } from "../src/events/types";
import * as stats from "../src/events/stats";
import * as replay from "../src/replay";
import { units, neutralLog } from "./rust-oracle";
import { toWebLog } from "../../typing-engine/src/text";
import type { Log } from "../../typing-engine/generated/types/Log";

const frozen = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../typing-fixtures/oracle/unicode-halves.json",
    ),
    "utf8",
  ),
) as { frames: { log: Log }[] };
const final = frozen.frames.at(-1);
if (final === undefined) throw new Error("Missing Unicode reference");
const session = createTestSession(
  { ...getDefaultConfig(), mode: "words", words: 2 },
  { words: ["\ud800 ", "\udc00"], dateNow: () => 0 },
);
await session.insert("\ud800", 0);
await session.insert(" ", 10);
session.record("composition", 20, { event: "start", wordIndex: 1 });
session.record("composition", 21, {
  event: "update",
  data: "\udc00",
  wordIndex: 1,
});
await session.insert("\udc00", 30, { isCompositionEnding: true });
session.record("composition", 40, {
  event: "end",
  data: "\udc00",
  wordIndex: 1,
});
const prompt = (words: replay.ReplayWord[]): unknown =>
  words.map((word) => ({
    ...word,
    letters: word.letters.map((letter) => ({
      ...letter,
      char: units(letter.char),
    })),
  }));
const references = [
  { name: "paired-target-split-events", log: toWebLog(final.log) as EventLog },
  { name: "isolated-targets-and-composition", log: session.buildEventLog() },
].map(({ name, log }) => {
  const queries: unknown[] = [];
  const expected: unknown[] = [];
  for (const time of [-1, 0, 10, 20, 50, 100]) {
    const frame = replay.replayFrame(log, time);
    queries.push({ op: "frame", time });
    expected.push({
      op: "frame",
      frame: {
        inputs: frame.inputs.map(units),
        activeIndex: frame.activeIndex,
      },
    });
  }
  const playback = [false, true].map((zen) => {
    const words = replay.getReplayWords(log, zen);
    const steps = replay.getReplaySteps(log, zen);
    queries.push({ op: "replay", zen });
    expected.push({
      op: "replay",
      words: words.map(units),
      steps: steps.map((step) => ({
        ...step,
        ...(typeof step.value === "string" ? { value: units(step.value) } : {}),
      })),
      duration: replay.replayDuration(log),
    });
    const finalWords = replay.createReplayPrompt(words, steps);
    const cursor = { wordIndex: 0, letterIndex: 0 };
    const sounds = steps.map(
      (step) => replay.applyReplayStep(finalWords, cursor, step) ?? null,
    );
    const seeks = [
      { wordIndex: 0, letterIndex: 0 },
      { wordIndex: 0, letterIndex: 1 },
      { wordIndex: 1, letterIndex: 1 },
    ].map((target) => {
      const seekWords = replay.createReplayPrompt(
        replay.getReplayWords(log, zen),
        steps,
      );
      const result = replay.seekReplay(seekWords, steps, target);
      return { target, ...result, words: prompt(seekWords) };
    });
    return { zen, words: prompt(finalWords), cursor, sounds, seeks };
  });
  return {
    name,
    log: neutralLog(log),
    queries,
    expected,
    playback,
    stats: {
      chars: stats.getChars(log, true),
      acc: stats.getAccuracy(log).percentage,
      history: stats.getInputHistory(log).map(units),
      corrected: stats.getCorrectedWordsHistory(log).map(units),
      wpm: stats.getWpmHistory(log),
      raw: stats.getRawHistory(log),
      burst: stats.getWordBurstHistory(log),
    },
  };
});
writeFileSync(
  resolve(
    import.meta.dirname,
    "../../typing-fixtures/oracle/historical-unicode.json",
  ),
  `${JSON.stringify(references, null, 2)}\n`,
  { flag: "wx" },
);
