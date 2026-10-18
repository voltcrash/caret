export let activeWordTop = 0;
export let activeWordHeight = 0;

export const lineState = {
  wordTopBeforeLineJump: 0,
  lineTransition: false,
  currentTestLine: 0,
  centeringActiveLine: Promise.resolve(),
  currentLinesJumping: 0,
};

export function updateActiveWordGeometry(word: HTMLElement): void {
  activeWordTop = word.offsetTop;
  activeWordHeight = word.offsetHeight;
}
