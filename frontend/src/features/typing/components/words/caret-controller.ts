import { createAppOwned } from "#app/application.ts";
import { appObject } from "#app/state.ts";
import { applyReducedMotion } from "#shared/utils/misc.ts";
import { hasClassName, updateClassNames } from "#shared/utils/cn.ts";
import { CaretStyle } from "@caret/schemas/configs";
import { peekConfig } from "#shared/config/store.ts";
import { countCodePoints, isWordRightToLeft } from "#shared/utils/strings.ts";
import {
  cancelPendingAnimationFrame,
  requestDebouncedAnimationFrame,
} from "#shared/utils/debounced-animation-frame.ts";
import { animate, EasingParam, JSAnimation } from "animejs";
import { caretGlideEasing, linearEasing } from "./caret-easing";
import { CaretGlide } from "./caret-glide";

import {
  getWordsElement as getWordsCache,
  getWordsWrapperElement as getWordsWrapperCache,
} from "#features/typing/state/test-dom.ts";
import * as TestWords from "../../runtime/test/words";
import { getWordElement } from "./elements";

const fullWidthStyles: ReadonlySet<CaretStyle> = new Set([
  "block",
  "outline",
  "underline",
]);
const smoothCaretDurations: Readonly<Record<string, number>> = {
  off: 0,
  slow: 150,
  medium: 100,
  fast: 85,
};

const lockedMainCaretInTape = true;
const debug = appObject(createAppOwned(() => ({ enabled: false })));

export function toggleCaretDebug(): void {
  debug.enabled = !debug.enabled;
  if (!debug.enabled) {
    for (const l of getWordsCache().querySelectorAll<HTMLElement>(
      ".word letter",
    )) {
      setClass(l, "debugCaret", false);
      setClass(l, "debugCaretTarget", false);
      setClass(l, "debugCaretTarget2", false);
    }
  } else {
    for (const l of getWordsCache().querySelectorAll<HTMLElement>(
      ".word letter",
    )) {
      setClass(l, "debugCaret", true);
    }
  }
}

/** Positions and animates one caret node owned by the Caret component. */
export class CaretController {
  private id: string;
  private element: HTMLElement;
  private style: CaretStyle = "default";
  private readyToResetMarginTop: boolean = false;
  private readyToResetMarginLeft: boolean = false;
  private isMainCaret: boolean = false;
  private cumulativeTapeMarginCorrection: number = 0;
  private wordMargins = new WeakMap<HTMLElement, number>();

  public clearGeometry(): void {
    this.wordMargins = new WeakMap();
  }

  // Position is a compositor `translate`; line and tape offsets stay margins
  // so they move in step with the words' own margin animations.
  private position: CaretGlide;
  private width: CaretGlide;
  private marginTopAnimation: JSAnimation | null = null;
  private marginLeftAnimation: JSAnimation | null = null;

  constructor(element: HTMLElement, style: CaretStyle) {
    this.id = element.id;
    this.element = element;
    this.position = new CaretGlide(element, "translate", [0, 0]);
    this.width = new CaretGlide(element, "width", [0]);
    this.setStyle(style);
    if (this.id === "caret") {
      this.isMainCaret = true;
    }
  }

  public setStyle(style: CaretStyle): void {
    this.style = style;
    this.resetWidth();
    setClass(
      this.element,
      [
        "off",
        "default",
        "underline",
        "outline",
        "block",
        "carrot",
        "banana",
        "monkey",
      ],
      false,
    );
    setClass(this.element, style === "monkey" ? "default" : style, true);
  }

  public show(): void {
    setClass(this.element, "hidden", false);
    Object.assign(this.element.style, { display: "" });
  }

  public hide(): void {
    setClass(this.element, "hidden", true);
  }

  public isHidden(): boolean {
    return hasClassName(this.element.className, "hidden");
  }

  public getWidth(): number {
    return this.element.offsetWidth;
  }

  public resetWidth(): void {
    this.width.clear();
  }

  public getHeight(): number {
    if (!this.isHidden()) {
      return this.element.offsetHeight;
    }

    let height = 0;
    this.show();
    height = this.element.offsetHeight;
    this.hide();
    return height;
  }

  public isFullWidth(): boolean {
    return fullWidthStyles.has(this.style);
  }

  public setPosition(options: {
    left: number;
    top: number;
    width?: number;
  }): void {
    this.position.jump([options.left, options.top]);
    if (options.width !== undefined) this.width.jump([options.width]);
  }

  public startBlinking(): void {
    if (peekConfig().smoothCaret !== "off") {
      Object.assign(this.element.style, { animationName: "caretFlashSmooth" });
    } else {
      Object.assign(this.element.style, { animationName: "caretFlashHard" });
    }
  }

  public stopBlinking(): void {
    Object.assign(this.element.style, { animationName: "none", opacity: "1" });
  }

  public updateBlinkingAnimation(): void {
    if (peekConfig().smoothCaret === "off") {
      Object.assign(this.element.style, { animationName: "caretFlashHard" });
    } else {
      Object.assign(this.element.style, { animationName: "caretFlashSmooth" });
    }
  }

  public stopAllAnimations(): void {
    this.position.stop();
    this.width.stop();
    this.marginTopAnimation?.cancel();
    this.marginLeftAnimation?.cancel();
  }

  public clearMargins(): void {
    Object.assign(this.element.style, { marginTop: "", marginLeft: "" });
    this.readyToResetMarginTop = false;
    this.readyToResetMarginLeft = false;
    this.cumulativeTapeMarginCorrection = 0;
  }

  public handleTapeWordsRemoved(widthRemoved: number): void {
    // Removing tape words reduces the absolute value of options.newValue passed to handleTapeScroll().
    // To keep the target marginLeft accurate, we reduce the absolute value of cumulative correction by the same amount.
    this.cumulativeTapeMarginCorrection += widthRemoved;
  }

  public handleTapeScroll(options: {
    newValue: number;
    duration: number;
    ease: EasingParam;
  }): void {
    if (this.isMainCaret && lockedMainCaretInTape) return;
    this.readyToResetMarginLeft = false;

    /**
     * options.newValue is the total width of all previously typed characters, and assuming we didn't
     * reset marginLeft or remove any tape words, then it would be the correct marginLeft to go to.
     *
     * Each time marginLeft is reset, the distance between options.newValue and the current
     * marginLeft-after-reset increases, making the caret shift too much left (in LTR).
     *
     * To correct this, we decrease the new target marginLeft by how much we've
     * reset the margin so far (cumulativeTapeMarginCorrection).
     */
    const newMarginLeft =
      options.newValue - this.cumulativeTapeMarginCorrection;

    if (options.duration === 0) {
      this.marginLeftAnimation?.cancel();
      Object.assign(this.element.style, { marginLeft: `${newMarginLeft}px` });
      this.readyToResetMarginLeft = true;
      return;
    }

    this.marginLeftAnimation = animate(this.element, {
      marginLeft: newMarginLeft,
      duration: applyReducedMotion(options.duration),
      ease: options.ease,
      onComplete: () => {
        this.readyToResetMarginLeft = true;
      },
    });
  }

  public handleLineJump(options: {
    newMarginTop: number;
    duration: number;
  }): void {
    // smooth line jump works by animating the words top margin.
    // to sync the carets to the lines, we need to do the same here.

    // using a readyToResetMarginTop flag here to make sure the animation
    // is fully finished before we reset the marginTop to 0

    // making sure to use a separate animation queue so that it doesnt
    // affect the position animations
    if (this.isMainCaret && options.duration === 0) return;

    // in case we have two line jumps in a row
    if (this.readyToResetMarginTop) {
      Object.assign(this.element.style, {
        marginTop: "0px",
      });
    }

    this.readyToResetMarginTop = false;

    if (options.duration === 0) {
      this.marginTopAnimation?.cancel();
      Object.assign(this.element.style, {
        marginTop: `${options.newMarginTop}px`,
      });
      this.readyToResetMarginTop = true;
      return;
    }

    this.marginTopAnimation = animate(this.element, {
      marginTop: options.newMarginTop,
      duration: applyReducedMotion(options.duration),
      onComplete: () => {
        this.readyToResetMarginTop = true;
      },
    });
  }

  public animatePosition(options: {
    left: number;
    top: number;
    duration?: number;
    easing?: "linear";
    width?: number;
  }): void {
    const smoothCaretSpeed =
      smoothCaretDurations[peekConfig().smoothCaret] ?? 0;

    const finalDuration = applyReducedMotion(
      options.duration ?? smoothCaretSpeed,
    );
    const easing =
      options.easing === "linear" ? linearEasing : caretGlideEasing;

    this.position.glide([options.left, options.top], finalDuration, easing);
    if (options.width !== undefined) {
      this.width.glide([options.width], finalDuration, easing);
    }
  }

  public cancelPendingMove(): void {
    cancelPendingAnimationFrame(`caret.${this.id}.goTo`);
  }

  public goTo(options: {
    wordIndex: number;
    letterIndex: number;
    isLanguageRightToLeft: boolean;
    isDirectionReversed: boolean;
    animate?: boolean;
    animationOptions?: {
      duration?: number;
      easing?: "linear";
    };
  }): void {
    if (this.style === "off") return;
    requestDebouncedAnimationFrame(`caret.${this.id}.goTo`, () => {
      const word = getWordElement(options.wordIndex);
      const wordText = TestWords.words.get(options.wordIndex)?.display ?? "";
      const wordLength = countCodePoints(wordText);

      // caret can be either on the left side of the target letter or the right
      // we stick to the left side unless we are on the last letter or beyond
      // then we switch to the right side

      // we also clamp the letterIndex to be within the range of actual letters
      // anything beyond just goes to the edge of the word
      let side: "beforeLetter" | "afterLetter" = "beforeLetter";
      if (peekConfig().mode === "zen") {
        if (options.letterIndex > 0) {
          side = "afterLetter";
          options.letterIndex -= 1;
        }
      } else {
        if (options.letterIndex >= wordLength) {
          side = "afterLetter";

          if (peekConfig().blindMode || peekConfig().hideExtraLetters) {
            options.letterIndex = wordLength - 1;
          } else {
            options.letterIndex -= 1;
          }
        }
      }

      if (options.letterIndex < 0) {
        options.letterIndex = 0;
      }

      if (word === null) return;

      const { left, top, width } = this.getTargetPositionAndWidth({
        word,
        letterIndex: options.letterIndex,
        wordText,
        side,
        isLanguageRightToLeft: options.isLanguageRightToLeft,
        isDirectionReversed: options.isDirectionReversed,
      });

      // margin animations use inline styles, so its fine to read inline here
      // instead of computed styles which would be much slower

      // if the margin animation finished, we reset it here by removing the margin
      // and offsetting the top by the same amount
      let currentMarginTop = parseFloat(this.element.style.marginTop || "0");
      if (this.readyToResetMarginTop) {
        this.readyToResetMarginTop = false;
        Object.assign(this.element.style, { marginTop: "0px" });
        this.position.shift([0, currentMarginTop]);
        currentMarginTop = 0;
      }

      // same for marginLeft
      let currentMarginLeft = parseFloat(this.element.style.marginLeft || "0");
      if (this.readyToResetMarginLeft) {
        this.readyToResetMarginLeft = false;
        Object.assign(this.element.style, { marginLeft: "0px" });
        this.position.shift([currentMarginLeft, 0]);
        this.cumulativeTapeMarginCorrection += currentMarginLeft;
        currentMarginLeft = 0;
      }

      /**
       * we subtract the margin from the target position in order to arrive at the intended location
       * if my margin is +20 and I wanna go to +50, then if I set my inline style left/top to +50
       * I will arrive to +70. However if I set it to (50 - 20), my left/top will be +30 and my margin
       * will be +20 and I will end up at (30 + 20) = 50
       */

      const animateOrPositionOptions = {
        left: left - currentMarginLeft,
        top: top - currentMarginTop,
        ...(this.isFullWidth() && { width }),
        ...(options.animate && options.animationOptions),
      };

      if (options.animate) {
        this.animatePosition(animateOrPositionOptions);
      } else {
        this.setPosition(animateOrPositionOptions);
      }
    });
  }

  private getTargetPositionAndWidth(options: {
    word: HTMLElement;
    letterIndex: number;
    wordText: string;
    side: "beforeLetter" | "afterLetter";
    isLanguageRightToLeft: boolean;
    isDirectionReversed: boolean;
  }): { left: number; top: number; width: number } {
    // Live collection: indexed reads only, no per-move NodeList copy.
    const letters = options.word.getElementsByTagName(
      "letter",
    ) as HTMLCollectionOf<HTMLElement>;

    if (letters.length === 0) {
      throw new Error(
        "Caret getTargetPositionAndWidth: no letters found in word",
      );
    }

    // Letters may lag the target index for a frame; clamp to rendered ones.
    const letterIndex = Math.min(options.letterIndex, letters.length - 1);
    let letter = letters[letterIndex];

    if (!letter) {
      throw new Error(
        `Caret getTargetPositionAndWidth: letter not found for index ${options.letterIndex}`,
      );
    }

    if (debug.enabled) {
      if (this.id === "paceCaret") {
        for (const l of getWordsCache().querySelectorAll<HTMLElement>(
          ".word letter",
        )) {
          setClass(l, "debugCaretTarget", false);
          setClass(l, "debugCaretTarget2", false);
          setClass(l, "debugCaret", true);
        }
        setClass(letter, "debugCaretTarget", true);
        setClass(this.element, "debug", true);
      }
    } else {
      setClass(this.element, "debug", false);
    }

    // in zen, custom or polyglot mode we need to check per-letter
    const checkRtlByLetter =
      peekConfig().mode === "zen" ||
      peekConfig().mode === "custom" ||
      peekConfig().funbox.includes("polyglot");
    const [isWordRTL, isFullMatch] = isWordRightToLeft(
      checkRtlByLetter ? (letter.textContent ?? "") : options.wordText,
      options.isLanguageRightToLeft,
      options.isDirectionReversed,
    );

    //if the letter is not visible, use the closest visible letter
    const isLetterVisible = letter.offsetWidth > 0;
    if (!isLetterVisible) {
      for (let i = letterIndex - 1; i >= 0; i--) {
        const loopLetter = letters[i] as HTMLElement;

        // find the closest visible letter before the current letter
        if (loopLetter.offsetWidth > 0) {
          letter = loopLetter;
          break;
        }
      }
      if (debug.enabled) {
        setClass(letter, "debugCaretTarget2", true);
      }
    }

    let spaceWidth = this.wordMargins.get(options.word);
    if (spaceWidth === undefined) {
      spaceWidth = getTotalInlineMargin(options.word);
      this.wordMargins.set(options.word, spaceWidth);
    }
    let width = spaceWidth;
    if (this.isFullWidth() && options.side === "beforeLetter") {
      width = letter.offsetWidth;
    }

    let left = 0;
    let top = 0;

    const tapeOffset =
      getWordsWrapperCache().offsetWidth * (peekConfig().tapeMargin / 100);

    // yes, this is all super verbose, but its easier to maintain and understand
    if (isWordRTL) {
      if (!checkRtlByLetter && isFullMatch) {
        setClass(options.word, "wordRtl", true);
      }
      let afterLetterCorrection = 0;
      if (options.side === "afterLetter") {
        if (this.isFullWidth()) {
          afterLetterCorrection += spaceWidth * -1;
        } else {
          afterLetterCorrection += letter.offsetWidth * -1;
        }
      }
      if (peekConfig().tapeMode === "off") {
        if (!this.isFullWidth()) {
          left += letter.offsetWidth;
        }
        left += letter.offsetLeft;
        left += options.word.offsetLeft;
        left += afterLetterCorrection;
      } else if (peekConfig().tapeMode === "word") {
        if (!this.isFullWidth()) {
          left += letter.offsetWidth;
        }
        left += options.word.offsetWidth * -1;
        left += letter.offsetLeft;
        left += afterLetterCorrection;
        if (this.isMainCaret && lockedMainCaretInTape) {
          left += getWordsWrapperCache().offsetWidth - tapeOffset;
        } else {
          left += options.word.offsetLeft;
          left += options.word.offsetWidth;
        }
      } else if (peekConfig().tapeMode === "letter") {
        if (this.isFullWidth()) {
          left += width * -1;
        }
        if (this.isMainCaret && lockedMainCaretInTape) {
          left += getWordsWrapperCache().offsetWidth - tapeOffset;
        } else {
          left += letter.offsetLeft;
          left += options.word.offsetLeft;
          left += afterLetterCorrection;
          left += width;
        }
      }
    } else {
      let afterLetterCorrection = 0;
      if (options.side === "afterLetter") {
        afterLetterCorrection += letter.offsetWidth;
      }
      if (peekConfig().tapeMode === "off") {
        left += letter.offsetLeft;
        left += options.word.offsetLeft;
        left += afterLetterCorrection;
      } else if (peekConfig().tapeMode === "word") {
        left += letter.offsetLeft;
        left += afterLetterCorrection;
        if (this.isMainCaret && lockedMainCaretInTape) {
          left += tapeOffset;
        } else {
          left += options.word.offsetLeft;
        }
      } else if (peekConfig().tapeMode === "letter") {
        if (this.isMainCaret && lockedMainCaretInTape) {
          left += tapeOffset;
        } else {
          left += letter.offsetLeft;
          left += options.word.offsetLeft;
          left += afterLetterCorrection;
        }
      }
    }

    //top position
    top += letter.offsetTop;
    top += options.word.offsetTop;

    if (this.style === "underline") {
      // if style is underline, add the height of the letter to the top
      top += letter.offsetHeight;
    } else {
      // else center vertically in the letter
      top += (letter.offsetHeight - this.getHeight()) / 2;
    }

    // also center horizontally
    if (!this.isFullWidth()) {
      left += (this.getWidth() / 2) * -1;
    }

    return {
      left,
      top,
      width,
    };
  }
}

function setClass(
  element: HTMLElement | undefined | null,
  names: string | string[],
  enabled: boolean,
): void {
  if (element) {
    const next = updateClassNames(
      element.className,
      Array.isArray(names) ? names.join(" ") : names,
      enabled,
    );
    if (element.className !== next) element.className = next;
  }
}

function getTotalInlineMargin(element: HTMLElement): number {
  const computedStyle = window.getComputedStyle(element);
  return (
    parseInt(computedStyle.marginRight) + parseInt(computedStyle.marginLeft)
  );
}
