import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadParityCases } from "../__test__/fixtures";
import type { EventLog } from "../src/events/types";
import {
  replayFrame,
  replayDuration,
  getReplayWords,
  getReplaySteps,
  createReplayPrompt,
  applyReplayStep,
  seekReplay,
} from "../src/replay";
import { buildPracticeWords } from "../src/practise-words";
import { getInvalidResultReason } from "../src/result-validity";
import { units } from "./rust-oracle";

const neutralPrompt = (words: ReturnType<typeof createReplayPrompt>): unknown =>
  words.map((word) => ({
    ...word,
    letters: word.letters.map((letter) => ({
      ...letter,
      char: units(letter.char),
    })),
  }));
const references = loadParityCases().map(({ name, fixture }) => {
  const log = fixture.eventLog as EventLog;
  const duration = replayDuration(log);
  const replay = [false, true].map((zen) => {
    const words = getReplayWords(log, zen);
    const steps = getReplaySteps(log, zen);
    const prompt = createReplayPrompt(words, steps);
    const cursor = { wordIndex: 0, letterIndex: 0 };
    const sounds = steps.map(
      (step) => applyReplayStep(prompt, cursor, step) ?? null,
    );
    const seeks = [
      { wordIndex: 0, letterIndex: 0 },
      { wordIndex: 1, letterIndex: 2 },
      { wordIndex: 3, letterIndex: 0 },
    ].map((target) => {
      const seekWords = createReplayPrompt(getReplayWords(log, zen), steps);
      const result = seekReplay(seekWords, steps, target);
      return { target, ...result, words: neutralPrompt(seekWords) };
    });
    return {
      zen,
      words: words.map(units),
      steps: steps.map((step) => ({
        ...step,
        ...(typeof step.value === "string" ? { value: units(step.value) } : {}),
      })),
      final: neutralPrompt(prompt),
      cursor,
      sounds,
      seeks,
    };
  });
  const words = log.context.targetWords.map((word) =>
    word.replace(/[ \n]$/, ""),
  );
  const practice = (["off", "words", "biwords"] as const).flatMap((missed) =>
    [false, true].map((slow) => {
      const notifications: string[] = [];
      const result = buildPracticeWords(log, words, missed, slow, (message) =>
        notifications.push(message),
      );
      return {
        missed,
        slow,
        result:
          result === null ? null : { ...result, text: result.text.map(units) },
        notifications,
      };
    }),
  );
  const recorded = fixture.completedEvent;
  const result = {
    mode: String(recorded["mode"]),
    mode2: String(recorded["mode2"]),
    testDuration: Number(recorded["testDuration"]),
    wpm: Number(recorded["wpm"]),
    rawWpm: Number(recorded["rawWpm"]),
    acc: Number(recorded["acc"]),
  } as Parameters<typeof getInvalidResultReason>[0]["result"];
  const validity = [false, true].flatMap((bailedOut) =>
    [false, true].flatMap((failed) =>
      [false, true].map((repeated) => {
        const input = {
          result,
          bailedOut,
          failed,
          repeated,
          lbOptOut: false,
          customLimit: { mode: "word" as const, value: 10 },
        };
        return {
          input,
          reason: getInvalidResultReason({ ...input, eventLog: log }) ?? null,
        };
      }),
    ),
  );
  return {
    name,
    frames: [-1, 0, duration / 4, duration / 2, duration].map((time) => {
      const frame = replayFrame(log, time);
      return {
        time,
        inputs: frame.inputs.map(units),
        activeIndex: frame.activeIndex,
      };
    }),
    replay,
    practice,
    validity,
  };
});
writeFileSync(
  resolve(import.meta.dirname, "../../typing-fixtures/oracle/analysis.json"),
  `${JSON.stringify(references, null, 2)}\n`,
  { flag: "wx" },
);
