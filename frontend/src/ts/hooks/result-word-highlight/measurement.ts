import {
  PADDING_X,
  PADDING_Y,
  PADDING_OFFSET_X,
  PADDING_OFFSET_Y,
  type Line,
} from "./types";
import { getBoundingRectOfElements } from "./geometry";
export function measureWordLines(
  RWH_el: HTMLElement,
  isRTL: boolean,
):
  | {
      lines: Line[];
      wordEls: HTMLElement[];
      wordIndexToLineIndexDict: Record<number, number>;
    }
  | undefined {
  const RWH_rect = RWH_el.getBoundingClientRect();
  const wordEls = [
    ...RWH_el.querySelectorAll<HTMLElement>(".words .word[input]"),
  ];

  if (wordEls.length === 0) {
    return undefined;
  }

  const measuredLines: Pick<
    Line,
    "rect" | "firstWordIndex" | "lastWordIndex"
  >[] = [];
  let prevLineEndWordIndex = -1;
  let currLineIndex = 0;

  const wordIndexToLineIndexDict: Record<number, number> = { 0: 0 };
  for (let i = 1; i < wordEls.length; i++) {
    const word = wordEls[i] as HTMLElement;
    const prevWord = wordEls[i - 1] as HTMLElement;

    if (word.offsetTop !== prevWord.offsetTop) {
      currLineIndex++;
      measuredLines.push({
        firstWordIndex: prevLineEndWordIndex + 1,
        lastWordIndex: i - 1,
        rect: getBoundingRectOfElements([
          wordEls[prevLineEndWordIndex + 1] as HTMLElement,
          prevWord,
        ]),
      });
      prevLineEndWordIndex = i - 1;
    }
    wordIndexToLineIndexDict[i] = currLineIndex;
  }

  measuredLines.push({
    firstWordIndex: prevLineEndWordIndex + 1,
    lastWordIndex: wordEls.length - 1,
    rect: getBoundingRectOfElements([
      wordEls[prevLineEndWordIndex + 1] as HTMLElement,
      wordEls[wordEls.length - 1] as HTMLElement,
    ]),
  });

  const RWH_width = RWH_rect.width;
  const RWH_height = RWH_rect.height;
  let inputWordIndex = 0;

  const newLines: Line[] = measuredLines.map((line) => {
    const HC_rect_top = line.rect.top - PADDING_OFFSET_Y;
    const HC_rect_left = line.rect.left - PADDING_OFFSET_X;
    const HC_rel_top = HC_rect_top - RWH_rect.top;
    const HC_rel_left = HC_rect_left - RWH_rect.left;
    const HC_width = line.rect.width + PADDING_X;
    const HC_height = line.rect.height + PADDING_Y;

    // for RTL languages, account for difference between highlightContainer left and RWH_el left
    const RTL_offset = isRTL ? line.rect.left - RWH_rect.left + PADDING_X : 0;

    const inputWords: Line["inputWords"] = [];
    for (let i = line.firstWordIndex; i <= line.lastWordIndex; i += 1) {
      const wordEl = wordEls[i] as HTMLElement;
      const userInputString = wordEl.getAttribute("input") ?? "";

      if (!userInputString) {
        continue;
      }

      inputWords.push({
        index: inputWordIndex++,
        left: wordEl.offsetLeft + PADDING_OFFSET_X - RTL_offset,
        text: userInputString
          .replace(/\t/g, "_")
          .replace(/\n/g, "_")
          .slice(0, wordEl.childElementCount),
      });
    }

    return {
      ...line,
      container: {
        top: `${(HC_rel_top / RWH_height) * 100}%`,
        left: `${(HC_rel_left / RWH_width) * 100}%`,
        width: `${(HC_width / RWH_width) * 100}%`,
        height: `${(HC_height / RWH_height) * 100}%`,
      },
      inputWordsContainer: {
        top: line.rect.top - HC_rect_top,
        left: line.rect.left - HC_rect_left,
        width: line.rect.width,
        height: line.rect.height,
      },
      inputWords,
    };
  });

  return { lines: newLines, wordEls, wordIndexToLineIndexDict };
}
