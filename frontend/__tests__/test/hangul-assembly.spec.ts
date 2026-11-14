import { createHash } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { assemble } from "../../src/features/typing/runtime/hangul-assembly";

// Frozen against the real 0.2.6 package before replacing it. Array input is
// intentional: unlike string input, existing syllables are not decomposed.
describe("Korean history assembly", () => {
  it.each([
    ["", ""],
    ["가ㄱ", "가ㄱ"],
    ["ㄳㅏ", "ㄳ"],
    ["ㄱㅏㄳㅏ", "가ㄳ"],
    ["ㄹㅂㅅ", "ㄼㅅ"],
    ["ㄱㅗㅏㄴㅏ", "과나"],
    ["한글 😀\n", "한글 😀\n"],
  ])("preserves %j", (input, expected) => {
    expect(assemble(input.split(""))).toBe(expected);
  });
  it("preserves every UTF-16 code unit and all compatibility-jamo triples", () => {
    const hash = createHash("sha256");
    const add = (s: string): void => {
      hash.update(JSON.stringify(assemble(s.split(""))));
    };
    for (let i = 0; i < 65536; i++) add(String.fromCharCode(i));
    const alphabet =
      "\0ㄱㄲㄳㄴㄵㄶㄷㄸㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅃㅄㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ가a ";
    for (const a of alphabet) {
      for (const b of alphabet) for (const c of alphabet) add(a + b + c);
    }
    expect(hash.digest("hex")).toBe(
      "b9f0dd9ddea70cc43d9f787a6afbed6a9b8f9e62cf5638a4ec41acc167d5b261",
    );
  });
  it("preserves longer sequences through every assembly state", () => {
    const hash = createHash("sha256");
    const alphabet =
      "\0ㄱㄲㄳㄴㄵㄶㄷㄸㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅃㅄㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ가a ";
    let seed = 17;
    for (let i = 0; i < 100000; i++) {
      let input = "";
      for (let j = 0; j < 12; j++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        input += alphabet[seed % alphabet.length];
      }
      hash.update(JSON.stringify(assemble(input.split(""))));
    }
    expect(hash.digest("hex")).toBe(
      "59b2515b83b98b7df8cda054464154a238b3ffb8670c2a11aa8c492c6d17d851",
    );
  });
});
