import { createAppOwned } from "#app/application.ts";
import {
  areTestElementsMounted,
  getWordsElement,
} from "#features/typing/state/test-dom.ts";

import { type CaretEasing, linearEasing } from "./caret-easing";

/**
 * Animates `#words` horizontal tape scroll (`translate`) and vertical line
 * jumps (`transform`) with the Web Animations API so typing-path scroll runs
 * on the compositor instead of mutating layout margins every frame.
 *
 * The two axes use independent compositor properties so multi-line tape mode
 * can scroll horizontally and jump lines without interfering with each other.
 */
class WordsScrollController {
  private fromX = 0;
  private toX = 0;
  private durationX = 0;
  private easingX: CaretEasing = linearEasing;
  private xAnimation: Animation | null = null;

  private fromY = 0;
  private toY = 0;
  private durationY = 0;
  private easingY: CaretEasing = linearEasing;
  private yAnimation: Animation | null = null;
  private yToken = 0;

  private readonly element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  public currentX(): number {
    const progress = this.progressOf(this.xAnimation, this.durationX);
    if (progress === null) {
      this.xAnimation = null;
      return this.toX;
    }
    return this.fromX + (this.toX - this.fromX) * this.easingX.at(progress);
  }

  public currentY(): number {
    const progress = this.progressOf(this.yAnimation, this.durationY);
    if (progress === null) {
      this.yAnimation = null;
      return this.toY;
    }
    return this.fromY + (this.toY - this.fromY) * this.easingY.at(progress);
  }

  public jumpX(x: number): void {
    this.cancelX();
    this.fromX = x;
    this.toX = x;
    this.durationX = 0;
    this.writeX(x);
  }

  /** Compensates removed tape words without interrupting an active scroll. */
  public shiftX(delta: number): void {
    this.fromX += delta;
    this.toX += delta;
    this.writeX(this.toX);
    const effect = this.xAnimation?.effect;
    if (
      this.progressOf(this.xAnimation, this.durationX) !== null &&
      effect instanceof KeyframeEffect
    ) {
      effect.setKeyframes({
        translate: [formatTranslateX(this.fromX), formatTranslateX(this.toX)],
      });
    }
  }

  public glideX(x: number, duration: number, easing: CaretEasing): void {
    if (
      this.progressOf(this.xAnimation, this.durationX) !== null &&
      this.toX === x
    ) {
      return;
    }
    const from = this.currentX();
    if (duration <= 0 || from === x) {
      this.jumpX(x);
      return;
    }
    this.cancelX();
    this.fromX = from;
    this.toX = x;
    this.durationX = duration;
    this.easingX = easing;
    this.writeX(x);
    this.xAnimation = this.element.animate(
      { translate: [formatTranslateX(from), formatTranslateX(x)] },
      { duration, easing: easing.css },
    );
  }

  /**
   * Animates a vertical line jump on the compositor. Resolves `true` if this
   * jump completed without being superseded or reset, `false` otherwise.
   */
  public async animateY(
    y: number,
    duration: number,
    easing: CaretEasing,
  ): Promise<boolean> {
    const token = ++this.yToken;
    const from = this.currentY();
    this.cancelY();
    if (duration <= 0 || from === y) {
      this.fromY = y;
      this.toY = y;
      this.durationY = 0;
      this.writeY(y);
      return true;
    }
    this.fromY = from;
    this.toY = y;
    this.durationY = duration;
    this.easingY = easing;
    this.writeY(y);
    const animation = this.element.animate(
      { transform: [formatTranslateY(from), formatTranslateY(y)] },
      { duration, easing: easing.css },
    );
    this.yAnimation = animation;
    try {
      await animation.finished;
    } catch {
      return false;
    }
    if (this.yAnimation === animation) {
      this.yAnimation = null;
      this.fromY = this.toY;
    }
    return token === this.yToken;
  }

  public resetY(): void {
    this.yToken++;
    this.cancelY();
    this.fromY = 0;
    this.toY = 0;
    this.durationY = 0;
    this.element.style.removeProperty("transform");
  }

  public reset(): void {
    this.cancelX();
    this.fromX = 0;
    this.toX = 0;
    this.durationX = 0;
    this.element.style.removeProperty("translate");
    this.resetY();
  }

  private cancelX(): void {
    this.xAnimation?.cancel();
    this.xAnimation = null;
  }

  private cancelY(): void {
    this.yAnimation?.cancel();
    this.yAnimation = null;
  }

  private progressOf(
    animation: Animation | null,
    duration: number,
  ): number | null {
    if (animation === null) return null;
    if (
      animation.playState === "finished" ||
      animation.playState === "idle" ||
      duration <= 0
    ) {
      return null;
    }
    const time = Number(animation.currentTime ?? 0);
    return Math.min(1, Math.max(0, time / duration));
  }

  private writeX(x: number): void {
    this.element.style.setProperty("translate", formatTranslateX(x));
  }

  private writeY(y: number): void {
    this.element.style.setProperty("transform", formatTranslateY(y));
  }
}

function formatTranslateX(x: number): string {
  return `${x}px`;
}

function formatTranslateY(y: number): string {
  return `translateY(${y}px)`;
}

const scrollState = createAppOwned(() => ({
  element: null as HTMLElement | null,
  controller: null as WordsScrollController | null,
}));

export function getWordsScroll(): WordsScrollController {
  const state = scrollState();
  const element = getWordsElement();
  if (state.element !== element || state.controller === null) {
    state.controller?.reset();
    state.element = element;
    state.controller = new WordsScrollController(element);
  }
  return state.controller;
}

export function getWordsOffsetX(): number {
  if (!areTestElementsMounted()) return 0;
  const state = scrollState();
  if (state.controller === null || state.element !== getWordsElement()) {
    return 0;
  }
  return state.controller.currentX();
}

export function getWordsOffsetY(): number {
  if (!areTestElementsMounted()) return 0;
  const state = scrollState();
  if (state.controller === null || state.element !== getWordsElement()) {
    return 0;
  }
  return state.controller.currentY();
}

export function resetWordsScroll(): void {
  const state = scrollState();
  state.controller?.reset();
  state.element = null;
  state.controller = null;
}
