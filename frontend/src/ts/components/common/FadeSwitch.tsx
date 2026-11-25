import {
  Accessor,
  createEffect,
  createSignal,
  JSXElement,
  on,
  onCleanup,
  untrack,
} from "solid-js";

import { applyReducedMotion } from "../../utils/misc";

/**
 * Crossfades between views when `value` changes (exit-before-enter via WAAPI).
 */
export function FadeSwitch<T>(props: {
  value: T;
  duration?: number;
  class?: string;
  children: (displayed: Accessor<T>) => JSXElement;
}): JSXElement {
  const [displayed, setDisplayed] = createSignal<T>(untrack(() => props.value));

  let el: HTMLDivElement | undefined;
  let animation: Animation | undefined;
  let token = 0;

  const cancelAnimation = (commit: boolean): void => {
    if (animation === undefined) return;
    if (commit && animation.playState !== "finished") {
      try {
        animation.commitStyles();
      } catch {
        // Unrendered elements fall back to inline/computed opacity.
      }
    }
    animation.cancel();
    animation = undefined;
  };

  createEffect(
    on(
      () => props.value,
      (next) => {
        if (Object.is(next, displayed())) return;
        const myToken = ++token;
        const duration = applyReducedMotion(props.duration ?? 125);

        if (!el || duration <= 0) {
          cancelAnimation(false);
          setDisplayed(() => next);
          if (el) el.style.opacity = "1";
          return;
        }

        cancelAnimation(true);
        const from = el.style.opacity || getComputedStyle(el).opacity || "1";
        el.style.opacity = "0";
        const exitAnim = el.animate(
          { opacity: [from, "0"] },
          { duration, easing: "ease-out" },
        );
        animation = exitAnim;

        void exitAnim.finished.then(
          () => {
            if (token !== myToken || animation !== exitAnim) return;
            animation = undefined;
            setDisplayed(() => next);
            if (!el) return;
            el.style.opacity = "1";
            const enterAnim = el.animate(
              { opacity: ["0", "1"] },
              { duration, easing: "ease-out" },
            );
            animation = enterAnim;
            void enterAnim.finished.then(
              () => {
                if (animation === enterAnim) animation = undefined;
              },
              () => undefined,
            );
          },
          () => undefined,
        );
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    token++;
    cancelAnimation(false);
  });

  return (
    <div ref={(node) => (el = node)} class={props.class}>
      {props.children(displayed)}
    </div>
  );
}
