import { peekConfig } from "#shared/config/store.ts";
import { applyReducedMotion } from "#shared/utils/misc.ts";

import {
  type CaretEasing,
  caretGlideEasing,
  linearEasing,
  lineJumpEasing,
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

function formatTransform(x: number, y: number): string {
  return `translate(${x}px, ${y}px)`;
}

/**
 * Line and tape offsets of one caret, animated on the compositor via
 * `transform` so they compose with `CaretGlide`'s `translate` and stay in step
 * with `#words`'s compositor scroll animations. Finished offsets fold into the
 * caret's `translate` position on the next `settle()`.
 */
export class CaretOffsets {
  private readyToResetY = false;
  private readyToResetX = false;
  private animatingY = false;
  private animatingX = false;
  private cumulativeTapeOffsetCorrection = 0;

  private fromX = 0;
  private toX = 0;
  private fromY = 0;
  private toY = 0;
  private duration = 0;
  private easing: CaretEasing = linearEasing;
  private animation: Animation | null = null;

  private readonly element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  public cancel(): void {
    this.animation?.cancel();
    this.animation = null;
    this.animatingX = false;
    this.animatingY = false;
  }

  public clear(): void {
    this.cancel();
    this.element.style.removeProperty("transform");
    this.fromX = 0;
    this.toX = 0;
    this.fromY = 0;
    this.toY = 0;
    this.duration = 0;
    this.readyToResetY = false;
    this.readyToResetX = false;
    this.cumulativeTapeOffsetCorrection = 0;
  }

  public handleTapeWordsRemoved(widthRemoved: number): void {
    // Removing tape words reduces the absolute value of options.newValue passed to handleTapeScroll().
    // To keep the target offsetX accurate, we reduce the absolute value of cumulative correction by the same amount.
    this.cumulativeTapeOffsetCorrection += widthRemoved;
  }

  public scrollTape(options: {
    newValue: number;
    duration: number;
    ease: CaretEasing;
  }): void {
    this.syncFinished();
    this.readyToResetX = false;

    /**
     * options.newValue is the total width of all previously typed characters, and assuming we didn't
     * reset offsetX or remove any tape words, then it would be the correct offsetX to go to.
     *
     * Each time offsetX is reset, the distance between options.newValue and the current
     * offsetX-after-reset increases, making the caret shift too much left (in LTR).
     *
     * To correct this, we decrease the new target offsetX by how much we've
     * reset the offset so far (cumulativeTapeOffsetCorrection).
     */
    const newOffsetX = options.newValue - this.cumulativeTapeOffsetCorrection;
    const duration = applyReducedMotion(options.duration);

    if (duration <= 0) {
      const currentY = this.currentY();
      if (this.animatingY) {
        this.fromX = newOffsetX;
        this.toX = newOffsetX;
        this.animatingX = false;
        this.readyToResetX = true;
        this.writeTransform();
        this.updateRunningKeyframes();
      } else {
        this.cancel();
        this.fromX = newOffsetX;
        this.toX = newOffsetX;
        this.fromY = currentY;
        this.toY = currentY;
        this.readyToResetX = true;
        this.writeTransform();
      }
      return;
    }

    const fromX = this.currentX();
    const fromY = this.currentY();
    const targetY = this.animatingY ? this.toY : fromY;

    this.cancel();
    this.fromX = fromX;
    this.toX = newOffsetX;
    this.fromY = fromY;
    this.toY = targetY;
    this.animatingX = true;
    this.animatingY = targetY !== fromY;
    this.startAnimation(duration, options.ease);
  }

  public jumpLine(options: { newMarginTop: number; duration: number }): void {
    this.syncFinished();

    // in case we have two line jumps in a row
    if (this.readyToResetY) {
      this.fromY = 0;
      this.toY = 0;
      this.writeTransform();
    }

    this.readyToResetY = false;
    const duration = applyReducedMotion(options.duration);

    if (duration <= 0) {
      const currentX = this.currentX();
      if (this.animatingX) {
        this.fromY = options.newMarginTop;
        this.toY = options.newMarginTop;
        this.animatingY = false;
        this.readyToResetY = true;
        this.writeTransform();
        this.updateRunningKeyframes();
      } else {
        this.cancel();
        this.fromX = currentX;
        this.toX = currentX;
        this.fromY = options.newMarginTop;
        this.toY = options.newMarginTop;
        this.readyToResetY = true;
        this.writeTransform();
      }
      return;
    }

    const fromX = this.currentX();
    const targetX = this.animatingX ? this.toX : fromX;
    const fromY = this.currentY();

    this.cancel();
    this.fromX = fromX;
    this.toX = targetX;
    this.fromY = fromY;
    this.toY = options.newMarginTop;
    this.animatingX = targetX !== fromX;
    this.animatingY = true;
    this.startAnimation(duration, lineJumpEasing);
  }

  /** Folds finished scroll offsets into `position`; returns the offsets left. */
  public settle(position: CaretGlide): {
    marginTop: number;
    marginLeft: number;
  } {
    this.syncFinished();

    let offsetY = this.currentY();
    let offsetX = this.currentX();
    let changed = false;

    // if the line-jump animation finished, reset offsetY and fold it into position
    if (this.readyToResetY) {
      this.readyToResetY = false;
      position.shift([0, offsetY]);
      this.fromY = 0;
      this.toY = 0;
      offsetY = 0;
      changed = true;
    }

    // same for tape offsetX
    if (this.readyToResetX) {
      this.readyToResetX = false;
      position.shift([offsetX, 0]);
      this.cumulativeTapeOffsetCorrection += offsetX;
      this.fromX = 0;
      this.toX = 0;
      offsetX = 0;
      changed = true;
    }

    if (changed) {
      this.writeTransform();
      this.updateRunningKeyframes();
    }

    return { marginTop: offsetY, marginLeft: offsetX };
  }

  private startAnimation(duration: number, easing: CaretEasing): void {
    this.duration = duration;
    this.easing = easing;
    this.writeTransform();
    const animation = this.element.animate(
      {
        transform: [
          formatTransform(this.fromX, this.fromY),
          formatTransform(this.toX, this.toY),
        ],
      },
      { duration, easing: easing.css },
    );
    this.animation = animation;
    animation.onfinish = () => {
      if (this.animation !== animation) return;
      this.finishCurrentAnimation();
    };
  }

  private syncFinished(): void {
    const animation = this.animation;
    if (animation === null) return;
    if (animation.playState === "finished") {
      this.finishCurrentAnimation();
    } else if (animation.playState === "idle") {
      this.animation = null;
      this.animatingX = false;
      this.animatingY = false;
    }
  }

  private finishCurrentAnimation(): void {
    this.animation = null;
    if (this.animatingX) {
      this.readyToResetX = true;
      this.animatingX = false;
    }
    if (this.animatingY) {
      this.readyToResetY = true;
      this.animatingY = false;
    }
    this.fromX = this.toX;
    this.fromY = this.toY;
  }

  private progress(): number | null {
    const animation = this.animation;
    if (animation === null) return null;
    if (
      animation.playState === "finished" ||
      animation.playState === "idle" ||
      this.duration <= 0
    ) {
      return null;
    }
    const time = Number(animation.currentTime ?? 0);
    return Math.min(1, Math.max(0, time / this.duration));
  }

  private currentX(): number {
    const progress = this.progress();
    if (progress === null) return this.toX;
    return this.fromX + (this.toX - this.fromX) * this.easing.at(progress);
  }

  private currentY(): number {
    const progress = this.progress();
    if (progress === null) return this.toY;
    return this.fromY + (this.toY - this.fromY) * this.easing.at(progress);
  }

  private writeTransform(): void {
    if (this.toX === 0 && this.toY === 0 && this.animation === null) {
      this.element.style.removeProperty("transform");
    } else {
      this.element.style.setProperty(
        "transform",
        formatTransform(this.toX, this.toY),
      );
    }
  }

  private updateRunningKeyframes(): void {
    const effect = this.animation?.effect;
    if (this.progress() !== null && effect instanceof KeyframeEffect) {
      effect.setKeyframes({
        transform: [
          formatTransform(this.fromX, this.fromY),
          formatTransform(this.toX, this.toY),
        ],
      });
    }
  }
}
