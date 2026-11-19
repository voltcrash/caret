import { type CaretEasing, linearEasing } from "./caret-easing";

/**
 * Animates one CSS property of a caret with the Web Animations API.
 *
 * `translate` animations run on the compositor, so the caret keeps gliding
 * while the main thread renders letters, stats and sounds. The final value is
 * also written inline, so nothing is left behind when an animation ends.
 * The script keeps the timing it handed over, so a retargeted move starts
 * exactly where the caret is drawn.
 */
export class CaretGlide {
  private from: number[];
  private to: number[];
  private duration = 0;
  private easing: CaretEasing = linearEasing;
  private animation: Animation | null = null;
  // False while CSS owns the property, so there is nothing to glide from.
  private inline = false;

  private readonly element: HTMLElement;
  private readonly property: "translate" | "width";
  private readonly initial: number[];

  constructor(
    element: HTMLElement,
    property: "translate" | "width",
    initial: number[],
  ) {
    this.element = element;
    this.property = property;
    this.initial = [...initial];
    this.from = [...initial];
    this.to = [...initial];
  }

  /** Value currently drawn. */
  public current(): number[] {
    const progress = this.progress();
    if (progress === null) return [...this.to];
    const eased = this.easing.at(progress);
    return this.to.map(
      (to, i) => (this.from[i] ?? to) + (to - (this.from[i] ?? to)) * eased,
    );
  }

  public isMoving(): boolean {
    return this.progress() !== null;
  }

  /** Draws `to` immediately. */
  public jump(to: number[]): void {
    this.cancelAnimation();
    this.from = [...to];
    this.to = [...to];
    this.write(to);
    this.inline = true;
  }

  /** Moves from the value currently drawn to `to`. */
  public glide(to: number[], duration: number, easing: CaretEasing): void {
    // Restarting toward the same target would only stall the glide.
    if (this.isMoving() && sameValues(this.to, to)) return;
    const from = this.current();
    if (!this.inline || duration <= 0 || sameValues(from, to)) {
      this.jump(to);
      return;
    }
    this.cancelAnimation();
    this.from = from;
    this.to = [...to];
    this.duration = duration;
    this.easing = easing;
    this.write(to);
    this.animation = this.element.animate(
      { [this.property]: [this.format(from), this.format(to)] },
      { duration, easing: easing.css },
    );
  }

  /** Moves the whole glide, keeping its timing; used to fold margins in. */
  public shift(delta: number[]): void {
    this.from = this.from.map((value, i) => value + (delta[i] ?? 0));
    this.to = this.to.map((value, i) => value + (delta[i] ?? 0));
    this.write(this.to);
    this.inline = true;
    const effect = this.animation?.effect;
    if (this.isMoving() && effect instanceof KeyframeEffect) {
      effect.setKeyframes({
        [this.property]: [this.format(this.from), this.format(this.to)],
      });
    }
  }

  /** Freezes the value currently drawn. */
  public stop(): void {
    if (this.isMoving()) this.jump(this.current());
  }

  /** Cancels any animation and hands the property back to CSS. */
  public clear(): void {
    this.cancelAnimation();
    this.from = [...this.initial];
    this.to = [...this.initial];
    this.inline = false;
    this.element.style.removeProperty(this.property);
  }

  private progress(): number | null {
    const animation = this.animation;
    if (animation === null) return null;
    if (
      animation.playState === "finished" ||
      animation.playState === "idle" ||
      this.duration <= 0
    ) {
      this.animation = null;
      return null;
    }
    // Pending animations have not drawn a frame yet.
    const time = Number(animation.currentTime ?? 0);
    return Math.min(1, Math.max(0, time / this.duration));
  }

  private cancelAnimation(): void {
    this.animation?.cancel();
    this.animation = null;
  }

  private write(value: number[]): void {
    this.element.style.setProperty(this.property, this.format(value));
  }

  private format(value: number[]): string {
    return value.map((part) => `${part}px`).join(" ");
  }
}

function sameValues(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
