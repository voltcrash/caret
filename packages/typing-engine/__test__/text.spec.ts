import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vite-plus/test";
import {
  decodeText,
  encodeText,
  toEngineLog,
  toWebLog,
  type WebLog,
} from "../src/text";

it("preserves every UTF-16 unit, including isolated surrogates, across bounded chunks", () => {
  const units = Array.from({ length: 65536 }, (_, index) => index);
  expect(encodeText(decodeText(units))).toEqual(units);
  for (const units of [[-1], [65536], [1.5], [NaN]]) {
    expect(() => decodeText(units)).toThrow("Invalid UTF-16");
  }
});
it("roundtrips all immutable website logs without changing optional fields or metadata", () => {
  const directory = resolve(
    import.meta.dirname,
    "../../typing-fixtures/reference/keystrokes",
  );
  for (const name of readdirSync(directory).filter((name) =>
    name.endsWith(".json"),
  )) {
    const fixture = JSON.parse(
      readFileSync(resolve(directory, name), "utf8"),
    ) as { eventLog: WebLog };
    const original = JSON.stringify(fixture.eventLog);
    expect(toWebLog(toEngineLog(fixture.eventLog)), name).toEqual(
      fixture.eventLog,
    );
    expect(JSON.stringify(fixture.eventLog)).toBe(original);
  }
});
it("neutralizes lone-surrogate input and composition text before JSON serialization", () => {
  const log: WebLog = {
    version: 1,
    context: {
      mode: "words",
      mode2: "1",
      targetWords: ["\ud800\udc00\ud800"],
      bailedOut: false,
      koreanStatus: false,
    },
    events: [
      {
        type: "input",
        testMs: 0,
        data: {
          data: "\ud800",
          inputValue: "\ud800",
          wordIndex: 0,
          correct: true,
        },
      },
      {
        type: "composition",
        testMs: 1,
        data: { event: "update", data: "\udc00", wordIndex: 0 },
      },
      { type: "keyup", testMs: 2, data: { code: "NoCode0", estimated: true } },
    ],
  };
  const neutral = toEngineLog(log);
  expect(neutral.context.targetWords).toEqual([[0xd800, 0xdc00, 0xd800]]);
  expect(neutral.events[0]?.data).toEqual({
    data: [0xd800],
    inputValue: [0xd800],
    wordIndex: 0,
    correct: true,
  });
  expect(neutral.events[1]?.data).toEqual({
    event: "update",
    data: [0xdc00],
    wordIndex: 0,
  });
  expect(JSON.stringify(neutral)).not.toContain("\\ud800");
  expect(toWebLog(neutral)).toEqual(log);
});
