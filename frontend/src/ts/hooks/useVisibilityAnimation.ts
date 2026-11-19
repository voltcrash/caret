import { Accessor, createEffect, createMemo, onCleanup } from "solid-js";
import { animate, AnimationParams, JSAnimation } from "animejs";
import { updateClassNames } from "../utils/cn";
import { reduceMotionParams } from "../utils/motion";

export function useVisibilityAnimation(options: {
  element: Accessor<HTMLElement | undefined>;
  isVisible: Accessor<boolean>;
  showAnimationOptions?: AnimationParams;
  hideAnimationOptions?: AnimationParams;
}): void {
  let showAnimation: undefined | JSAnimation = undefined;
  let hideAnimation: undefined | JSAnimation = undefined;
  // Callers may report the same visibility again (the loader bar is hidden on
  // every keystroke); only a change should restart an animation.
  const isVisible = createMemo(() => options.isVisible());

  createEffect(() => {
    const el = options.element();
    const visible = isVisible();

    if (!el) return;

    if (visible) {
      hideAnimation?.pause();
      showAnimation = animate(
        el,
        reduceMotionParams({
          opacity: 1,
          duration: 125,
          ...options.showAnimationOptions,
          onBegin: (self) => {
            el.className = updateClassNames(el.className, "hidden", false);
            options.showAnimationOptions?.onBegin?.(self);
          },
        }),
      );
    } else {
      showAnimation?.pause();
      hideAnimation = animate(
        el,
        reduceMotionParams({
          opacity: 0,
          duration: 125,
          ...options.hideAnimationOptions,
          onComplete: (self) => {
            el.className = updateClassNames(el.className, "hidden", true);
            options.hideAnimationOptions?.onComplete?.(self);
          },
        }),
      );
    }

    onCleanup(() => {
      showAnimation?.pause();
      hideAnimation?.pause();
    });
  });
}
