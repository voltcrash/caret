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
  let exiting = false;
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

  const startEnter = (
    node: HTMLDivElement,
    from: string,
    duration: number,
  ): void => {
    node.style.opacity = "1";
    const enterAnim = node.animate(
      { opacity: [from, "1"] },
      { duration, easing: "ease-out" },
    );
    animation = enterAnim;
    void enterAnim.finished.then(
      () => {
        if (animation === enterAnim) animation = undefined;
      },
      () => undefined,
    );
  };

  createEffect(
    on(
      () => props.value,
      (next) => {
        const matchesDisplayed = Object.is(next, displayed());
        if (matchesDisplayed && !exiting) return;

        const myToken = ++token;
        const duration = applyReducedMotion(props.duration ?? 125);

        if (matchesDisplayed) {
          exiting = false;
          if (!el || duration <= 0) {
            cancelAnimation(false);
            if (el) el.style.opacity = "1";
            return;
          }
          cancelAnimation(true);
          const from = el.style.opacity || getComputedStyle(el).opacity || "0";
          startEnter(el, from, duration);
          return;
        }

        if (!el || duration <= 0) {
          exiting = false;
          cancelAnimation(false);
          setDisplayed(() => next);
          if (el) el.style.opacity = "1";
          return;
        }

        exiting = true;
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
            exiting = false;
            animation = undefined;
            setDisplayed(() => next);
            if (!el) return;
            startEnter(el, "0", duration);
          },
          () => undefined,
        );
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    token++;
    exiting = false;
    cancelAnimation(false);
  });

  return (
    <div ref={(node) => (el = node)} class={props.class}>
      {props.children(displayed)}
    </div>
  );
}
