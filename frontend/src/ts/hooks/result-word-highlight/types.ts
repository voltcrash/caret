export const PADDING_X = 16;
export const PADDING_Y = 12;
export const PADDING_OFFSET_X = PADDING_X / 2;
export const PADDING_OFFSET_Y = PADDING_Y / 2;

// a line of text in the words history
export type Line = {
  rect: DOMRect;
  firstWordIndex: number;
  lastWordIndex: number;
  // % relative to the words history element
  container: { top: string; left: string; width: string; height: string };
  // px relative to the highlight container
  inputWordsContainer: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  inputWords: {
    // index into inputWordEls
    index: number;
    left: number;
    text: string;
  }[];
};

export type HighlightPosition = {
  highlightLeft: number;
  highlightRight: number;
  inputContainerLeft: number;
  inputContainerRight: number;
};
