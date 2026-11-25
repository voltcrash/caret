import { Accessor, createEffect, createMemo, onCleanup } from "solid-js";

import { updateClassNames } from "../utils/cn";
import { applyReducedMotion } from "../utils/misc";

export type VisibilityAnimationOptions = {
  duration?: number;
  delay?: number;
  easing?: string;
  onBegin?: () => void;
  onComplete?: () => void;
};

function readOpacity(element: HTMLElement, fallback: string): string {
  if (element.style.opacity !== "") return element.style.opacity;
  const computed = getComputedStyle(element).opacity;
  return computed !== "" ? computed : fallback;
}

export function useVisibilityAnimation(options: {
  element: Accessor<HTMLElement | undefined>;
  isVisible: Accessor<boolean>;
  showAnimationOptions?: VisibilityAnimationOptions;
  hideAnimationOptions?: VisibilityAnimationOptions;
}): void {
  let activeAnimation: Animation | undefined;
  // Callers may report the same visibility again (the loader bar is hidden on
  // every keystroke); only a change should restart an animation.
  const isVisible = createMemo(() => options.isVisible());

  const stopActive = (el: HTMLElement): void => {
    if (activeAnimation === undefined) return;
    if (activeAnimation.playState !== "finished") {
      try {
        activeAnimation.commitStyles();
      } catch {
        // Hidden/unrendered elements cannot commit; fall back to inline opacity.
      }
    }
    activeAnimation.cancel();
    activeAnimation = undefined;
    // Keep inline opacity readable if commitStyles wrote it on `el`.
    void el;
  };

  createEffect(() => {
    const el = options.element();
    const visible = isVisible();

    if (!el) return;

    stopActive(el);

    const animOptions = visible
      ? options.showAnimationOptions
      : options.hideAnimationOptions;
    const duration = applyReducedMotion(animOptions?.duration ?? 125);
    const delay = applyReducedMotion(animOptions?.delay ?? 0);
    const easing = animOptions?.easing ?? "ease-out";

    if (visible) {
      el.className = updateClassNames(el.className, "hidden", false);
      animOptions?.onBegin?.();
      const from = readOpacity(el, "0");
      el.style.opacity = "1";
      if (duration <= 0 && delay <= 0) {
        animOptions?.onComplete?.();
      } else {
        const current = el.animate(
          { opacity: [from, "1"] },
          {
            duration,
            delay,
            easing,
            fill: delay > 0 ? "backwards" : "none",
          },
        );
        activeAnimation = current;
        void current.finished.then(
          () => {
            if (activeAnimation !== current) return;
            activeAnimation = undefined;
            animOptions?.onComplete?.();
          },
          () => undefined,
        );
      }
    } else {
      animOptions?.onBegin?.();
      const from = readOpacity(el, "1");
      el.style.opacity = "0";
      if (duration <= 0 && delay <= 0) {
        el.className = updateClassNames(el.className, "hidden", true);
        animOptions?.onComplete?.();
      } else {
        const current = el.animate(
          { opacity: [from, "0"] },
          {
            duration,
            delay,
            easing,
            fill: delay > 0 ? "backwards" : "none",
          },
        );
        activeAnimation = current;
        void current.finished.then(
          () => {
            if (activeAnimation !== current) return;
            activeAnimation = undefined;
            el.className = updateClassNames(el.className, "hidden", true);
            animOptions?.onComplete?.();
          },
          () => undefined,
        );
      }
    }

    onCleanup(() => {
      activeAnimation?.cancel();
      activeAnimation = undefined;
    });
  });
}
