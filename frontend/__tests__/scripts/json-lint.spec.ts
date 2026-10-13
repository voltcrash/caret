import { describe, it, expect } from "vite-plus/test";
import { lintJson } from "../../scripts/json-lint";

const messages = (source: string): string[] =>
  lintJson(source).map((it) => it.message);

describe("lintJson", () => {
  it("accepts valid json", () => {
    expect(
      lintJson('{"a": [1, -2.5, 1e3, "x\\"y", true, null], "b": {"a": 0}}'),
    ).toEqual([]);
  });

  it("reports parse errors", () => {
    expect(messages('{"a": }')[0]).toMatch(/^Unable to parse /);
  });

  it("reports duplicate keys with position", () => {
    expect(lintJson('{\n  "a": 1,\n  "a": 2\n}')).toEqual([
      { line: 3, column: 3, message: 'duplicate key "a"' },
    ]);
  });

  it("tracks keys per object", () => {
    expect(lintJson('[{"a": 1}, {"a": 2}, {"b": {"a": {"a": 3}}}]')).toEqual(
      [],
    );
  });

  it("ignores string values that look like keys", () => {
    expect(lintJson('{"a": "a", "b": ["a", "a"]}')).toEqual([]);
  });

  it("detects duplicates written with escapes", () => {
    expect(messages('{"a": 1, "\\u0061": 2}')).toEqual(['duplicate key "a"']);
  });

  it("reports empty keys", () => {
    expect(messages('{"": 1, " ": 2}')).toEqual(["empty key", "empty key"]);
  });

  it("reports unnormalized keys", () => {
    expect(messages('{"e\\u0301": 1}')).toEqual([
      'key "é" is not NFC normalized',
    ]);
  });

  it("reports unsafe numbers", () => {
    expect(messages("[9007199254740993, 1e400, 1e-400, 5e-324]")).toEqual([
      "integer 9007199254740993 is outside the safe integer range",
      "number 1e400 evaluates to Infinity",
      "number 1e-400 rounds to zero",
      "number 5e-324 is subnormal",
    ]);
  });

  it("allows zero and large floats", () => {
    expect(lintJson("[0, -0, 0.0, 0e5, 1.5e300]")).toEqual([]);
  });

  it("reports lone surrogates", () => {
    expect(messages('["\\ud800", "\\udc00x", "\\ud83d\\ude00"]')).toEqual([
      "string contains a lone surrogate",
      "string contains a lone surrogate",
    ]);
  });
});
