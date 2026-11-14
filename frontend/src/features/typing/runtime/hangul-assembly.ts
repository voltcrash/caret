/**
 * Array-input assembly adapted from Hangul.js 0.2.6 (Jaemin Jo, MIT).
 * See hangul-assembly.LICENSE. Keep legacy treatment of existing syllables,
 * compound jamo and NUL: history rendering depends on these exact semantics.
 */
const initials = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const vowels = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const finals = "\0ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
function indexOf(table: string, code: number): number {
  if (code === 0) return 0;
  const index = table.indexOf(String.fromCharCode(code));
  return index < 0 ? Number.NaN : index;
}
const initialIndex = (code: number): number => indexOf(initials, code);
const vowelIndex = (code: number): number => indexOf(vowels, code);
const finalIndex = (code: number): number => indexOf(finals, code);
const isInitial = (code: number): boolean => !Number.isNaN(initialIndex(code));
const isVowel = (code: number): boolean => !Number.isNaN(vowelIndex(code));
const isFinal = (code: number): boolean => !Number.isNaN(finalIndex(code));
function join(table: string, first: number, second: number): number {
  for (const triple of table.split(" ")) {
    if (triple.charCodeAt(0) === first && triple.charCodeAt(1) === second) {
      return triple.charCodeAt(2);
    }
  }
  return 0;
}
const joinVowel = (a: number, b: number): number =>
  join("ㅗㅏㅘ ㅗㅐㅙ ㅗㅣㅚ ㅜㅓㅝ ㅜㅔㅞ ㅜㅣㅟ ㅡㅣㅢ", a, b);
const joinFinal = (a: number, b: number): number =>
  join(
    "ㄱㅅㄳ ㄴㅈㄵ ㄴㅎㄶ ㄹㄱㄺ ㄹㅁㄻ ㄹㅂㄼ ㄹㅅㄽ ㄹㅌㄾ ㄹㅍㄿ ㄹㅎㅀ ㅂㅅㅄ",
    a,
    b,
  );

export function assemble(array: string[]): string {
  const codeAt = (index: number): number =>
    array[index]?.charCodeAt(0) ?? Number.NaN;
  const result: string[] = [];
  let length = array.length,
    code = 0,
    stage = 0,
    completeIndex = -1,
    previousCode = 0,
    joinedFinal = false;

  function makeHangul(index: number): void {
    let cho = 0,
      jung1 = 0,
      jung2 = 0,
      jong1 = 0,
      jong2 = 0,
      hangul = "";

    joinedFinal = false;
    if (completeIndex + 1 > index) {
      return;
    }
    for (let step = 1; ; step++) {
      if (step === 1) {
        cho = codeAt(completeIndex + step);
        if (isVowel(cho)) {
          if (
            completeIndex + step + 1 <= index &&
            isVowel((jung1 = codeAt(completeIndex + step + 1)))
          ) {
            result.push(String.fromCharCode(joinVowel(cho, jung1)));
            completeIndex = index;
            return;
          } else {
            result.push(array[completeIndex + step] ?? "");
            completeIndex = index;
            return;
          }
        } else if (!isInitial(cho)) {
          result.push(array[completeIndex + step] ?? "");
          completeIndex = index;
          return;
        }
        hangul = array[completeIndex + step] ?? "";
      } else if (step === 2) {
        jung1 = codeAt(completeIndex + step);
        if (isInitial(jung1)) {
          cho = joinFinal(cho, jung1);
          hangul = String.fromCharCode(cho);
          result.push(hangul);
          completeIndex = index;
          return;
        } else {
          hangul = String.fromCharCode(
            (initialIndex(cho) * 21 + vowelIndex(jung1)) * 28 + 0xac00,
          );
        }
      } else if (step === 3) {
        jung2 = codeAt(completeIndex + step);
        if (joinVowel(jung1, jung2)) {
          jung1 = joinVowel(jung1, jung2);
        } else {
          jong1 = jung2;
        }
        hangul = String.fromCharCode(
          (initialIndex(cho) * 21 + vowelIndex(jung1)) * 28 +
            finalIndex(jong1) +
            0xac00,
        );
      } else if (step === 4) {
        jong2 = codeAt(completeIndex + step);
        if (joinFinal(jong1, jong2)) {
          jong1 = joinFinal(jong1, jong2);
        } else {
          jong1 = jong2;
        }
        hangul = String.fromCharCode(
          (initialIndex(cho) * 21 + vowelIndex(jung1)) * 28 +
            finalIndex(jong1) +
            0xac00,
        );
      } else if (step === 5) {
        jong2 = codeAt(completeIndex + step);
        jong1 = joinFinal(jong1, jong2);
        hangul = String.fromCharCode(
          (initialIndex(cho) * 21 + vowelIndex(jung1)) * 28 +
            finalIndex(jong1) +
            0xac00,
        );
      }

      if (completeIndex + step >= index) {
        result.push(hangul);
        completeIndex = index;
        return;
      }
    }
  }

  let i = 0;
  for (; i < length; i++) {
    code = codeAt(i);
    if (!isInitial(code) && !isVowel(code) && !isFinal(code)) {
      makeHangul(i - 1);
      makeHangul(i);
      stage = 0;
      continue;
    }

    if (stage === 0) {
      if (isInitial(code)) {
        stage = 1;
      } else if (isVowel(code)) {
        stage = 4;
      }
    } else if (stage === 1) {
      if (isVowel(code)) {
        stage = 2;
      } else {
        if (joinFinal(previousCode, code)) {
          stage = 5;
        } else {
          makeHangul(i - 1);
        }
      }
    } else if (stage === 2) {
      if (isFinal(code)) {
        stage = 3;
      } else if (isVowel(code)) {
        if (!joinVowel(previousCode, code)) {
          makeHangul(i - 1);
          stage = 4;
        }
      } else {
        makeHangul(i - 1);
        stage = 1;
      }
    } else if (stage === 3) {
      if (isFinal(code)) {
        if (!joinedFinal && joinFinal(previousCode, code)) {
          joinedFinal = true;
        } else {
          makeHangul(i - 1);
          stage = 1;
        }
      } else if (isInitial(code)) {
        makeHangul(i - 1);
        stage = 1;
      } else if (isVowel(code)) {
        makeHangul(i - 2);
        stage = 2;
      }
    } else if (stage === 4) {
      if (isVowel(code)) {
        if (joinVowel(previousCode, code)) {
          makeHangul(i);
          stage = 0;
        } else {
          makeHangul(i - 1);
        }
      } else {
        makeHangul(i - 1);
        stage = 1;
      }
    } else if (stage === 5) {
      if (isVowel(code)) {
        makeHangul(i - 2);
        stage = 2;
      } else {
        makeHangul(i - 1);
        stage = 1;
      }
    }
    previousCode = code;
  }
  makeHangul(i - 1);
  return result.join("");
}
