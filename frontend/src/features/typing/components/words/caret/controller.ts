import { CaretStyle } from "@caret/schemas/configs";

import { peekConfig } from "#shared/config/store.ts";
import { hasClassName } from "#shared/utils/cn.ts";
import {
  cancelPendingAnimationFrame,
  requestDebouncedAnimationFrame,
} from "#shared/utils/debounced-animation-frame.ts";
import { countCodePoints } from "#shared/utils/strings.ts";

import * as TestWords from "../../../runtime/test/words";
import { setCaretClass } from "./dom";
import {
  getCaretTargetPositionAndWidth,
  isFullWidthCaretStyle,
  lockedMainCaretInTape,
} from "./geometry";
import {
  applyCaretBlinkAnimation,
  CaretOffsets,
  getCaretGlideTiming,
  stopCaretBlinkAnimation,
} from "./motion";
import { type CaretEasing } from "../caret-easing";
import { CaretGlide } from "../caret-glide";
import { getWordElement } from "../elements";

/** Positions and animates one caret node owned by the Caret component. */
export class CaretController {
  private id: string;
  private element: HTMLElement;
  private style: CaretStyle = "default";
  private isMainCaret: boolean = false;
  private wordMargins = new WeakMap<HTMLElement, number>();

  public clearGeometry(): void {
    this.wordMargins = new WeakMap();
  }

  // Position is a compositor `translate`; line and tape offsets animate on
  // `transform` so they compose on the GPU and move in step with `#words`.
  private position: CaretGlide;
  private width: CaretGlide;
  private margins: CaretOffsets;

  constructor(element: HTMLElement, style: CaretStyle) {
    this.id = element.id;
    this.element = element;
    this.position = new CaretGlide(element, "translate", [0, 0]);
    this.width = new CaretGlide(element, "width", [0]);
    this.margins = new CaretOffsets(element);
    this.setStyle(style);
    if (this.id === "caret") {
      this.isMainCaret = true;
    }
  }

  public setStyle(style: CaretStyle): void {
    this.style = style;
    this.resetWidth();
    setCaretClass(
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
    setCaretClass(this.element, style === "monkey" ? "default" : style, true);
  }

  public show(): void {
    setCaretClass(this.element, "hidden", false);
    Object.assign(this.element.style, { display: "" });
  }

  public hide(): void {
    setCaretClass(this.element, "hidden", true);
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
    return isFullWidthCaretStyle(this.style);
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
    applyCaretBlinkAnimation(this.element);
  }

  public stopBlinking(): void {
    stopCaretBlinkAnimation(this.element);
  }

  public updateBlinkingAnimation(): void {
    applyCaretBlinkAnimation(this.element);
  }

  public stopAllAnimations(): void {
    this.position.stop();
    this.width.stop();
    this.margins.cancel();
  }

  public clearMargins(): void {
    this.margins.clear();
  }

  public handleTapeWordsRemoved(widthRemoved: number): void {
    this.margins.handleTapeWordsRemoved(widthRemoved);
  }

  public handleTapeScroll(options: {
    newValue: number;
    duration: number;
    ease: CaretEasing;
  }): void {
    if (this.isMainCaret && lockedMainCaretInTape) return;
    this.margins.scrollTape(options);
  }

  public handleLineJump(options: {
    newMarginTop: number;
    duration: number;
  }): void {
    // smooth line jump works by animating `#words` with a vertical transform.
    // to sync the carets to the lines, we animate `transform` in lockstep here
    // and fold the finished offset into `translate` on the next settle.
    if (this.isMainCaret && options.duration === 0) return;
    this.margins.jumpLine(options);
  }

  public animatePosition(options: {
    left: number;
    top: number;
    duration?: number;
    easing?: "linear";
    width?: number;
  }): void {
    const { duration, easing } = getCaretGlideTiming(options);

    this.position.glide([options.left, options.top], duration, easing);
    if (options.width !== undefined) {
      this.width.glide([options.width], duration, easing);
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

      const { left, top, width } = getCaretTargetPositionAndWidth(
        {
          id: this.id,
          element: this.element,
          style: this.style,
          isMainCaret: this.isMainCaret,
          wordMargins: this.wordMargins,
          getWidth: () => this.getWidth(),
          getHeight: () => this.getHeight(),
        },
        {
          word,
          letterIndex: options.letterIndex,
          wordText,
          side,
          isLanguageRightToLeft: options.isLanguageRightToLeft,
          isDirectionReversed: options.isDirectionReversed,
        },
      );

      const { marginTop: currentMarginTop, marginLeft: currentMarginLeft } =
        this.margins.settle(this.position);

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
}
