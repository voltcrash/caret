import { getMutableConfig } from "../../../../config/store";
import { getActivePage } from "../../../../states/core";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
  getResultVisible,
} from "../../../../states/test";
import { getWordsElement as getWordsEl } from "../../../../states/test-dom";
import * as TestWords from "../../../../test/test-words";
import * as Misc from "../../../../utils/misc";
import * as Strings from "../../../../utils/strings";

export const updateHintsPositionDebounced = Misc.debounceUntilResolved(
  updateHintsPosition,
  { rejectSkippedCalls: false },
);

export function createHintsNodes(
  incorrectLettersIndices: number[][],
  activeWordLetters: HTMLElement[],
  input: string | string[],
  wrapWithDiv: boolean = true,
): DocumentFragment {
  // if input is an array, it contains only incorrect letters input.
  // if input is a string, it contains the whole word input.
  const isFullWord = typeof input === "string";
  const inputChars = isFullWord ? Strings.splitIntoCharacters(input) : input;

  const nodes = document.createDocumentFragment();
  let currentHint = 0;

  for (const adjacentLetters of incorrectLettersIndices) {
    for (const letterIndex of adjacentLetters) {
      const letter = activeWordLetters[letterIndex] as HTMLElement;
      const blockIndices = `${letterIndex}`;
      const blockChars = isFullWord
        ? inputChars[letterIndex]
        : inputChars[currentHint++];

      const hint = document.createElement("hint");
      hint.dataset["charsIndex"] = blockIndices;
      hint.style.left = `${letter.offsetLeft + letter.offsetWidth / 2}px`;
      hint.textContent = blockChars ?? "";
      nodes.append(hint);
    }
  }
  if (!wrapWithDiv) return nodes;
  const container = document.createElement("div");
  container.className = "hints";
  container.append(nodes);
  const wrapped = document.createDocumentFragment();
  wrapped.append(container);
  return wrapped;
}

export async function joinOverlappingHints(
  incorrectLettersIndices: number[][],
  activeWordLetters: HTMLElement[],
  hintElements: HTMLCollection,
): Promise<void> {
  const currentWord = TestWords.words.getCurrent();
  if (currentWord === undefined) return;

  const [isWordRightToLeft] = Strings.isWordRightToLeft(
    currentWord.text,
    isLanguageRightToLeft(),
    isDirectionReversed(),
  );

  let previousBlocksAdjacent = false;
  let currentHintBlock = 0;
  let HintBlocksCount = hintElements.length;
  while (currentHintBlock < HintBlocksCount - 1) {
    const hintBlock1 = hintElements[currentHintBlock] as HTMLElement;
    const hintBlock2 = hintElements[currentHintBlock + 1] as HTMLElement;

    const block1Indices = hintBlock1.dataset["charsIndex"]?.split(",") ?? [];
    const block2Indices = hintBlock2.dataset["charsIndex"]?.split(",") ?? [];

    const block1Letter1Indx = parseInt(block1Indices[0] ?? "0");
    const block2Letter1Indx = parseInt(block2Indices[0] ?? "0");

    const currentBlocksAdjacent = incorrectLettersIndices.some(
      (adjacentLettersSequence) =>
        adjacentLettersSequence.includes(block1Letter1Indx) &&
        adjacentLettersSequence.includes(block2Letter1Indx),
    );

    if (!currentBlocksAdjacent) {
      currentHintBlock++;
      previousBlocksAdjacent = false;
      continue;
    }

    const block1Letter1 = activeWordLetters[block1Letter1Indx] as HTMLElement;
    const block2Letter1 = activeWordLetters[block2Letter1Indx] as HTMLElement;

    const sameTop = block1Letter1.offsetTop === block2Letter1.offsetTop;

    const leftBlock = isWordRightToLeft ? hintBlock2 : hintBlock1;
    const rightBlock = isWordRightToLeft ? hintBlock1 : hintBlock2;

    // block edge is offset half its width because of transform: translate(-50%)
    const leftBlockEnds = leftBlock.offsetLeft + leftBlock.offsetWidth / 2;
    const rightBlockStarts = rightBlock.offsetLeft - rightBlock.offsetWidth / 2;

    if (sameTop && leftBlockEnds > rightBlockStarts) {
      // join hint blocks
      hintBlock1.dataset["charsIndex"] = [
        ...block1Indices,
        ...block2Indices,
      ].join(",");

      const block1Letter1Pos =
        block1Letter1.offsetLeft +
        (isWordRightToLeft ? block1Letter1.offsetWidth : 0);
      const bothBlocksLettersWidthHalved =
        hintBlock2.offsetLeft - hintBlock1.offsetLeft;
      hintBlock1.style.left = `${block1Letter1Pos + bothBlocksLettersWidthHalved}px`;

      hintBlock1.append(...hintBlock2.childNodes);
      hintBlock2.remove();

      // after joining blocks, the sequence is shorter
      HintBlocksCount--;
      // check if the newly formed block overlaps with the previous one
      if (previousBlocksAdjacent && currentHintBlock > 0) currentHintBlock--;
    } else {
      currentHintBlock++;
    }
    previousBlocksAdjacent = true;
  }
}

async function updateHintsPosition(): Promise<void> {
  if (
    getActivePage() !== "test" ||
    getResultVisible() ||
    (getMutableConfig().indicateTypos !== "below" &&
      getMutableConfig().indicateTypos !== "both")
  ) {
    return;
  }

  let previousHintsContainer: HTMLElement | undefined;
  let hintIndices: number[][] = [];
  let hintText: string[] = [];

  const hintElements =
    getWordsEl().querySelectorAll<HTMLElement>(".hints > hint");

  for (const hintEl of hintElements) {
    const hintsContainer = hintEl.parentElement as HTMLElement;

    if (hintsContainer !== previousHintsContainer) {
      await adjustHintsContainer(previousHintsContainer, hintIndices, hintText);
      previousHintsContainer = hintsContainer;
      hintIndices = [];
      hintText = [];
    }

    const letterIndices = hintEl.dataset["charsIndex"]
      ?.split(",")
      .map((index) => parseInt(index));

    if (letterIndices === undefined || letterIndices.length === 0) continue;

    for (const currentLetterIndex of letterIndices) {
      const lastBlock = hintIndices[hintIndices.length - 1];
      if (lastBlock?.[lastBlock.length - 1] === currentLetterIndex - 1) {
        lastBlock.push(currentLetterIndex);
      } else {
        hintIndices.push([currentLetterIndex]);
      }
    }

    hintText.push(...Strings.splitIntoCharacters(hintEl.textContent ?? ""));
  }
  await adjustHintsContainer(previousHintsContainer, hintIndices, hintText);

  async function adjustHintsContainer(
    hintsContainer: HTMLElement | undefined,
    hintIndices: number[][],
    hintText: string[],
  ): Promise<void> {
    if (!hintsContainer || hintIndices.length === 0) return;

    const wordElement = hintsContainer.parentElement as HTMLElement;
    const letterElements = Array.from(
      wordElement.querySelectorAll<HTMLElement>("letter"),
    );

    hintsContainer.replaceChildren(
      createHintsNodes(hintIndices, letterElements, hintText, false),
    );
    const wordHintsElements = wordElement.getElementsByTagName("hint");
    await joinOverlappingHints(hintIndices, letterElements, wordHintsElements);
  }
}
