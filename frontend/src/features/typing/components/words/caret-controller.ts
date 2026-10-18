import { applyReducedMotion } from "../../../../ts/utils/misc";
import { updateClassNames } from "../../../../ts/utils/cn";
import { CaretStyle } from "@oxytype/schemas/configs";
import { getMutableConfig } from "../../../../ts/config/store";
import { isWordRightToLeft } from "../../../../ts/utils/strings";
import { requestDebouncedAnimationFrame } from "../../../../ts/utils/debounced-animation-frame";
import { animate, EasingParam, JSAnimation } from "animejs";

import {
  getWordsElement as getWordsCache,
  getWordsWrapperElement as getWordsWrapperCache,
} from "../../../../ts/states/test-dom";
import * as TestWords from "../../runtime/test-words";

let lockedMainCaretInTape = true;
let caretDebug = false;

export function toggleCaretDebug(): void {
  caretDebug = !caretDebug;
  if (!caretDebug) {
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

  private posAnimation: JSAnimation | null = null;
  private marginTopAnimation: JSAnimation | null = null;
  private marginLeftAnimation: JSAnimation | null = null;

  constructor(element: HTMLElement, style: CaretStyle) {
    this.id = element.id;
    this.element = element;
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
    return this.element.className.split(/\s+/).includes("hidden");
  }

  public getWidth(): number {
    return this.element.offsetWidth;
  }

  public resetWidth(): void {
    Object.assign(this.element.style, { width: "" });
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
    return ["block", "outline", "underline"].includes(this.style);
  }

  public setPosition(options: {
    left: number;
    top: number;
    width?: number;
  }): void {
    this.posAnimation?.cancel();
    let newStyle: Record<string, string> = {
      left: `${options.left}px`,
      top: `${options.top}px`,
    };
    if (options.width !== undefined) {
      newStyle = { ...newStyle, width: `${options.width}px` };
    }
    Object.assign(this.element.style, newStyle);
  }

  public startBlinking(): void {
    if (getMutableConfig().smoothCaret !== "off") {
      Object.assign(this.element.style, { animationName: "caretFlashSmooth" });
    } else {
      Object.assign(this.element.style, { animationName: "caretFlashHard" });
    }
  }

  public stopBlinking(): void {
    Object.assign(this.element.style, { animationName: "none", opacity: "1" });
  }

  public updateBlinkingAnimation(): void {
    if (getMutableConfig().smoothCaret === "off") {
      Object.assign(this.element.style, { animationName: "caretFlashHard" });
    } else {
      Object.assign(this.element.style, { animationName: "caretFlashSmooth" });
    }
  }

  public stopAllAnimations(): void {
    this.posAnimation?.cancel();
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
    easing?: EasingParam;
    width?: number;
  }): void {
    const smoothCaretSpeed =
      getMutableConfig().smoothCaret === "off"
        ? 0
        : getMutableConfig().smoothCaret === "slow"
          ? 150
          : getMutableConfig().smoothCaret === "medium"
            ? 100
            : getMutableConfig().smoothCaret === "fast"
              ? 85
              : 0;

    const finalDuration = applyReducedMotion(
      options.duration ?? smoothCaretSpeed,
    );

    const animation: Record<string, number> = {
      left: options.left,
      top: options.top,
    };

    if (options.width !== undefined) {
      animation["width"] = options.width;
    }

    this.posAnimation = animate(this.element, {
      ...animation,
      duration: finalDuration,
      ease: options.easing ?? "inOut(1.25)",
    });
  }

  public goTo(options: {
    wordIndex: number;
    letterIndex: number;
    isLanguageRightToLeft: boolean;
    isDirectionReversed: boolean;
    animate?: boolean;
    animationOptions?: {
      duration?: number;
      easing?: string;
    };
  }): void {
    if (this.style === "off") return;
    requestDebouncedAnimationFrame(`caret.${this.id}.goTo`, () => {
      const word = getWordsCache().querySelector<HTMLElement>(
        `.word[data-wordindex="${options.wordIndex}"]`,
      );
      const wordText = TestWords.words.get(options.wordIndex)?.display ?? "";
      const wordLength = Array.from(wordText).length;

      // caret can be either on the left side of the target letter or the right
      // we stick to the left side unless we are on the last letter or beyond
      // then we switch to the right side

      // we also clamp the letterIndex to be within the range of actual letters
      // anything beyond just goes to the edge of the word
      let side: "beforeLetter" | "afterLetter" = "beforeLetter";
      if (getMutableConfig().mode === "zen") {
        if (options.letterIndex > 0) {
          side = "afterLetter";
          options.letterIndex -= 1;
        }
      } else {
        if (options.letterIndex >= wordLength) {
          side = "afterLetter";

          if (
            getMutableConfig().blindMode ||
            getMutableConfig().hideExtraLetters
          ) {
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

      // animation uses inline styles, so its fine to read inline here instead
      // of computed styles which would be much slower

      // if the margin animation finished, we reset it here by removing the margin
      // and offsetting the top by the same amount
      let currentMarginTop = parseFloat(this.element.style.marginTop || "0");
      if (this.readyToResetMarginTop) {
        this.readyToResetMarginTop = false;
        const currentTop = parseFloat(this.element.style.top || "0");

        Object.assign(this.element.style, {
          marginTop: "0px",
          top: `${currentTop + currentMarginTop}px`,
        });
        currentMarginTop = 0;
      }

      // same for marginLeft
      let currentMarginLeft = parseFloat(this.element.style.marginLeft || "0");
      if (this.readyToResetMarginLeft) {
        this.readyToResetMarginLeft = false;
        const currentLeft = parseFloat(this.element.style.left || "0");

        Object.assign(this.element.style, {
          marginLeft: "0px",
          left: `${currentLeft + currentMarginLeft}px`,
        });
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
    const letters = Array.from(
      options.word.querySelectorAll<HTMLElement>("letter"),
    );

    if (letters.length === 0) {
      throw new Error(
        "Caret getTargetPositionAndWidth: no letters found in word",
      );
    }

    let letter = letters[options.letterIndex] ?? letters[letters.length - 1];

    if (!letter) {
      throw new Error(
        `Caret getTargetPositionAndWidth: letter not found for index ${options.letterIndex}`,
      );
    }

    if (caretDebug) {
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
      getMutableConfig().mode === "zen" ||
      getMutableConfig().mode === "custom" ||
      getMutableConfig().funbox.includes("polyglot");
    const [isWordRTL, isFullMatch] = isWordRightToLeft(
      checkRtlByLetter ? (letter.textContent ?? "") : options.wordText,
      options.isLanguageRightToLeft,
      options.isDirectionReversed,
    );

    //if the letter is not visible, use the closest visible letter
    const isLetterVisible = letter.offsetWidth > 0;
    if (!isLetterVisible) {
      for (let i = options.letterIndex - 1; i >= 0; i--) {
        const loopLetter = letters[i] as HTMLElement;

        // find the closest visible letter before the current letter
        if (loopLetter.offsetWidth > 0) {
          letter = loopLetter;
          break;
        }
      }
      if (caretDebug) {
        setClass(letter, "debugCaretTarget2", true);
      }
    }

    const spaceWidth = getTotalInlineMargin(options.word);
    let width = spaceWidth;
    if (this.isFullWidth() && options.side === "beforeLetter") {
      width = letter.offsetWidth;
    }

    let left = 0;
    let top = 0;

    const tapeOffset =
      getWordsWrapperCache().offsetWidth *
      (getMutableConfig().tapeMargin / 100);

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
      if (getMutableConfig().tapeMode === "off") {
        if (!this.isFullWidth()) {
          left += letter.offsetWidth;
        }
        left += letter.offsetLeft;
        left += options.word.offsetLeft;
        left += afterLetterCorrection;
      } else if (getMutableConfig().tapeMode === "word") {
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
      } else if (getMutableConfig().tapeMode === "letter") {
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
      if (getMutableConfig().tapeMode === "off") {
        left += letter.offsetLeft;
        left += options.word.offsetLeft;
        left += afterLetterCorrection;
      } else if (getMutableConfig().tapeMode === "word") {
        left += letter.offsetLeft;
        left += afterLetterCorrection;
        if (this.isMainCaret && lockedMainCaretInTape) {
          left += tapeOffset;
        } else {
          left += options.word.offsetLeft;
        }
      } else if (getMutableConfig().tapeMode === "letter") {
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
    element.className = updateClassNames(
      element.className,
      Array.isArray(names) ? names.join(" ") : names,
      enabled,
    );
  }
}

function getTotalInlineMargin(element: HTMLElement): number {
  const computedStyle = window.getComputedStyle(element);
  return (
    parseInt(computedStyle.marginRight) + parseInt(computedStyle.marginLeft)
  );
}
