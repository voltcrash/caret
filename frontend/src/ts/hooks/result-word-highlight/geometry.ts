import {
  PADDING_X,
  PADDING_OFFSET_X,
  type Line,
  type HighlightPosition,
} from "./types";
export type HighlightGeometry = {
  lines: Line[];
  wordEls: HTMLElement[];
  wordIndexToLineIndexDict: Record<number, number>;
  highlightContainerEls: HTMLElement[];
  inputWordsContainerEls: HTMLElement[];
  inputWordEls: HTMLElement[];
};
export function getHighlightElementPositions(
  geometry: HighlightGeometry,
  firstWordIndex: number,
  lastWordIndex: number,
  isRTL = false,
): HighlightPosition[] {
  const {
    lines: currentLines,
    wordEls,
    wordIndexToLineIndexDict,
    highlightContainerEls,
    inputWordsContainerEls,
  } = geometry;
  const lineIndexOfFirstWord = wordIndexToLineIndexDict[
    firstWordIndex
  ] as number;
  const highlightPositions = new Array(currentLines.length)
    .fill(null)
    .map(() => ({
      highlightLeft: 0,
      highlightRight: 0,
      inputContainerLeft: 0,
      inputContainerRight: 0,
    })) as HighlightPosition[];

  const highlightWidth: number = getHighlightWidth(
    geometry,
    firstWordIndex,
    lastWordIndex,
  );

  const firstWordEl = wordEls[firstWordIndex];
  const line = currentLines[lineIndexOfFirstWord];
  const linePos = highlightPositions[lineIndexOfFirstWord];
  const container = highlightContainerEls[lineIndexOfFirstWord];
  const inputContainer = inputWordsContainerEls[lineIndexOfFirstWord];

  if (
    firstWordEl === undefined ||
    line === undefined ||
    linePos === undefined ||
    container === undefined ||
    inputContainer === undefined
  ) {
    return highlightPositions;
  }

  // origin for line highlight starts at
  if (!isRTL) {
    linePos.highlightLeft = firstWordEl.offsetLeft;
    linePos.highlightRight =
      line.rect.width - (linePos.highlightLeft + highlightWidth) + PADDING_X;
  } else {
    const offsetLeftOfHighlightContainer = container.offsetLeft;

    linePos.highlightRight =
      line.rect.width -
      (firstWordEl.offsetLeft + firstWordEl.offsetWidth) +
      offsetLeftOfHighlightContainer +
      PADDING_OFFSET_X;

    linePos.highlightLeft =
      line.rect.width - (linePos.highlightRight + highlightWidth) + PADDING_X;
  }

  if (!isRTL) {
    linePos.inputContainerLeft = -1 * linePos.highlightLeft;
  } else {
    linePos.inputContainerLeft =
      -1 *
      (inputContainer.getBoundingClientRect().width -
        highlightWidth -
        linePos.highlightRight);
  }

  // offsets for lines above, going from zero to lineIndexOfWord
  for (let i = lineIndexOfFirstWord - 1; i >= 0; i--) {
    const position = highlightPositions[i];
    const nextPosition = highlightPositions[i + 1];
    const line = currentLines[i];
    const container = inputWordsContainerEls[i];
    if (
      position === undefined ||
      line === undefined ||
      nextPosition === undefined ||
      container === undefined
    ) {
      continue;
    }

    if (!isRTL) {
      position.highlightLeft =
        nextPosition.highlightLeft + line.rect.width + PADDING_X;

      position.highlightRight =
        line.rect.width - (position.highlightLeft + highlightWidth) + PADDING_X;

      position.inputContainerLeft = -1 * position.highlightLeft;
    } else {
      position.highlightRight =
        nextPosition.highlightRight + line.rect.width + PADDING_X;

      position.highlightLeft =
        line.rect.width -
        (position.highlightRight + highlightWidth) +
        PADDING_X;

      position.inputContainerLeft =
        -1 *
        (container.getBoundingClientRect().width -
          highlightWidth -
          position.highlightRight);
    }
  }

  // offsets for lines below, going from lineIndexOfWord to lines.length
  for (let i = lineIndexOfFirstWord + 1; i < currentLines.length; i++) {
    const position = highlightPositions[i];
    const previousLine = currentLines[i - 1];
    const line = currentLines[i];
    const prevHighlightPosition = highlightPositions[i - 1];
    const container = inputWordsContainerEls[i];

    if (
      position === undefined ||
      previousLine === undefined ||
      line === undefined ||
      prevHighlightPosition === undefined ||
      container === undefined
    ) {
      continue;
    }

    if (!isRTL) {
      position.highlightLeft =
        -1 *
        (previousLine.rect.width -
          prevHighlightPosition.highlightLeft +
          PADDING_X);

      position.highlightRight =
        line.rect.width - (position.highlightLeft + highlightWidth) + PADDING_X;

      position.inputContainerLeft = -1 * position.highlightLeft;
    } else {
      position.highlightRight =
        -1 *
        (previousLine.rect.width -
          prevHighlightPosition.highlightRight +
          PADDING_X);

      position.highlightLeft =
        line.rect.width -
        (position.highlightRight + highlightWidth) +
        PADDING_X;

      position.inputContainerLeft =
        -1 *
        (container.getBoundingClientRect().width -
          highlightWidth -
          position.highlightRight);
    }
  }

  return highlightPositions;
}

// width of the highlight for a given range of words
function getHighlightWidth(
  geometry: HighlightGeometry,
  wordStartIndex: number,
  wordEndIndex: number,
): number {
  const {
    lines: currentLines,
    wordEls,
    wordIndexToLineIndexDict,
    inputWordEls,
  } = geometry;
  const lineIndexOfWordStart = wordIndexToLineIndexDict[wordStartIndex];
  const lineIndexOfWordEnd = wordIndexToLineIndexDict[wordEndIndex];

  if (lineIndexOfWordStart === undefined || lineIndexOfWordEnd === undefined) {
    return 0;
  }

  const startWord = wordEls[wordStartIndex];
  const endWord = wordEls[wordEndIndex];
  const inputEndWord = inputWordEls[wordEndIndex];
  const startLineLastWord =
    wordEls[currentLines[lineIndexOfWordStart]?.lastWordIndex ?? -1];
  const endLineFirstWord =
    wordEls[currentLines[lineIndexOfWordEnd]?.firstWordIndex ?? -1];

  if (
    startWord === undefined ||
    endWord === undefined ||
    inputEndWord === undefined ||
    startLineLastWord === undefined ||
    endLineFirstWord === undefined
  ) {
    return 0;
  }

  // highlight is just one line
  if (lineIndexOfWordStart === lineIndexOfWordEnd) {
    const highlightRect = getBoundingRectOfElements([startWord, endWord]);
    const lastWordElRect = endWord.getBoundingClientRect();

    const lastInputWordElRect = inputEndWord.getBoundingClientRect();
    let width = highlightRect.width + PADDING_X;
    width -= lastWordElRect.width - lastInputWordElRect.width;
    return width;
  }

  // multiple lines
  const firstLineBounds = getBoundingRectOfElements([
    startWord,
    startLineLastWord,
  ]);

  const lastLineBounds = getBoundingRectOfElements([endLineFirstWord, endWord]);

  let width = firstLineBounds.width + lastLineBounds.width;

  // middle line highlights
  for (let i = lineIndexOfWordStart + 1; i < lineIndexOfWordEnd; i++) {
    width += (currentLines[i] as Line).rect.width;
  }

  // padding
  width += 2 * PADDING_X * (lineIndexOfWordEnd - lineIndexOfWordStart);

  // difference between last wordEl and last inputWordEl
  const lastWordElRect = endWord.getBoundingClientRect();
  const lastInputWordElRect = inputEndWord.getBoundingClientRect();
  width -= lastWordElRect.width - lastInputWordElRect.width;
  return width;
}

export function getBoundingRectOfElements(elements: HTMLElement[]): DOMRect {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  elements.forEach((element) => {
    const rect = element.getBoundingClientRect();

    minX = Math.min(minX, rect.left);
    minY = Math.min(minY, rect.top);
    maxX = Math.max(maxX, rect.right);
    maxY = Math.max(maxY, rect.bottom);
  });

  // Create a new object with the same properties as a DOMRect
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    top: minY,
    right: maxX,
    bottom: maxY,
    left: minX,
    toJSON: function (): string {
      return JSON.stringify({
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        top: this.top,
        right: this.right,
        bottom: this.bottom,
        left: this.left,
      });
    },
  };
}
