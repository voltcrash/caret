import { animate, EasingParam, JSAnimation } from "animejs";

import { peekConfig } from "#shared/config/store.ts";
import { applyReducedMotion } from "#shared/utils/misc.ts";

import {
  type CaretEasing,
  caretGlideEasing,
  linearEasing,
} from "../caret-easing";
import { CaretGlide } from "../caret-glide";

const smoothCaretDurations: Readonly<Record<string, number>> = {
  off: 0,
  slow: 150,
  medium: 100,
  fast: 85,
};

/** Duration and easing for a smooth caret move. */
export function getCaretGlideTiming(options: {
  duration?: number;
  easing?: "linear";
}): { duration: number; easing: CaretEasing } {
  const smoothCaretSpeed = smoothCaretDurations[peekConfig().smoothCaret] ?? 0;

  const duration = applyReducedMotion(options.duration ?? smoothCaretSpeed);
  const easing = options.easing === "linear" ? linearEasing : caretGlideEasing;
  return { duration, easing };
}

export function applyCaretBlinkAnimation(element: HTMLElement): void {
  if (peekConfig().smoothCaret !== "off") {
    Object.assign(element.style, { animationName: "caretFlashSmooth" });
  } else {
    Object.assign(element.style, { animationName: "caretFlashHard" });
  }
}

export function stopCaretBlinkAnimation(element: HTMLElement): void {
  Object.assign(element.style, { animationName: "none", opacity: "1" });
}

/**
 * Line and tape offsets of one caret. They stay margins so they move in step
 * with the words' own margin animations, and fold into the caret position once
 * an animation finishes.
 */
export class CaretMargins {
  private readyToResetMarginTop: boolean = false;
  private readyToResetMarginLeft: boolean = false;
  private cumulativeTapeMarginCorrection: number = 0;
  private marginTopAnimation: JSAnimation | null = null;
  private marginLeftAnimation: JSAnimation | null = null;

  private readonly element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  public cancel(): void {
    this.marginTopAnimation?.cancel();
    this.marginLeftAnimation?.cancel();
  }

  public clear(): void {
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

  public scrollTape(options: {
    newValue: number;
    duration: number;
    ease: EasingParam;
  }): void {
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

  public jumpLine(options: { newMarginTop: number; duration: number }): void {
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

  /** Folds finished margin animations into `position`; returns the margins left. */
  public settle(position: CaretGlide): {
    marginTop: number;
    marginLeft: number;
  } {
    // margin animations use inline styles, so its fine to read inline here
    // instead of computed styles which would be much slower

    // if the margin animation finished, we reset it here by removing the margin
    // and offsetting the top by the same amount
    let marginTop = parseFloat(this.element.style.marginTop || "0");
    if (this.readyToResetMarginTop) {
      this.readyToResetMarginTop = false;
      Object.assign(this.element.style, { marginTop: "0px" });
      position.shift([0, marginTop]);
      marginTop = 0;
    }

    // same for marginLeft
    let marginLeft = parseFloat(this.element.style.marginLeft || "0");
    if (this.readyToResetMarginLeft) {
      this.readyToResetMarginLeft = false;
      Object.assign(this.element.style, { marginLeft: "0px" });
      position.shift([marginLeft, 0]);
      this.cumulativeTapeMarginCorrection += marginLeft;
      marginLeft = 0;
    }

    return { marginTop, marginLeft };
  }
}
