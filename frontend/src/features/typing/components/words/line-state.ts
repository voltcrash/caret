import { createAppOwned } from "../../../../app/application";
import { appObject } from "../../../../app/state";

type LineState = {
  activeWordTop: number;
  activeWordHeight: number;
  wordTopBeforeLineJump: number;
  lineTransition: boolean;
  currentTestLine: number;
  centeringActiveLine: Promise<void>;
  currentLinesJumping: number;
};

export const lineState = appObject(
  createAppOwned<LineState>(() => ({
    activeWordTop: 0,
    activeWordHeight: 0,
    wordTopBeforeLineJump: 0,
    lineTransition: false,
    currentTestLine: 0,
    centeringActiveLine: Promise.resolve(),
    currentLinesJumping: 0,
  })),
);

export function updateActiveWordGeometry(word: HTMLElement): void {
  lineState.activeWordTop = word.offsetTop;
  lineState.activeWordHeight = word.offsetHeight;
}
