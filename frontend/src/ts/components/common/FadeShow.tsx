import {
  createEffect,
  createSignal,
  JSXElement,
  on,
  onCleanup,
  ParentProps,
  Show,
  untrack,
} from "solid-js";

import { cn } from "../../utils/cn";
import { applyReducedMotion } from "../../utils/misc";

export type FadeShowProps = ParentProps<{
  when: boolean;
  slide?: boolean;
  duration?: number;
  class?: string;
}>;

/**
 * Conditionally renders children with a WAAPI opacity fade, or a CSS Grid
 * `grid-template-rows` (`0fr` <-> `1fr`) reveal when `slide` is set (zero
 * forced layout reads).
 */
export function FadeShow(props: FadeShowProps): JSXElement {
  const [mounted, setMounted] = createSignal(untrack(() => props.when));
  const [el, setEl] = createSignal<HTMLDivElement | undefined>(undefined);

  let innerEl: HTMLDivElement | undefined;
  let animation: Animation | undefined;
  let token = 0;

  const cancelAnimation = (commit: boolean): void => {
    if (animation === undefined) return;
    if (commit && animation.playState !== "finished") {
      try {
        animation.commitStyles();
      } catch {
        // Unrendered elements fall back to inline/initial styles.
      }
    }
    animation.cancel();
    animation = undefined;
  };

  const runEnter = (node: HTMLDivElement): void => {
    const myToken = ++token;
    const duration = applyReducedMotion(props.duration ?? 125);
    cancelAnimation(true);

    if (props.slide) {
      const fromRows =
        node.style.gridTemplateRows !== "" &&
        node.style.gridTemplateRows !== "1fr"
          ? node.style.gridTemplateRows
          : "0fr";
      node.style.gridTemplateRows = "1fr";
      if (duration > 0) {
        if (innerEl) innerEl.style.overflow = "hidden";
        const current = node.animate(
          { gridTemplateRows: [fromRows, "1fr"] },
          { duration, easing: "ease-out" },
        );
        animation = current;
        void current.finished.then(
          () => {
            if (token !== myToken || animation !== current) return;
            animation = undefined;
            if (innerEl) innerEl.style.overflow = "";
          },
          () => undefined,
        );
      } else if (innerEl) {
        innerEl.style.overflow = "";
      }
      return;
    }

    const from =
      node.style.opacity !== "" && node.style.opacity !== "1"
        ? node.style.opacity
        : "0";
    node.style.opacity = "1";
    if (duration > 0) {
      const current = node.animate(
        { opacity: [from, "1"] },
        { duration, easing: "ease-out" },
      );
      animation = current;
      void current.finished.then(
        () => {
          if (token !== myToken || animation !== current) return;
          animation = undefined;
        },
        () => undefined,
      );
    }
  };

  const runExit = (node: HTMLDivElement | undefined): void => {
    const myToken = ++token;
    const duration = applyReducedMotion(props.duration ?? 125);
    if (!node || duration <= 0) {
      cancelAnimation(false);
      setEl(undefined);
      setMounted(false);
      return;
    }
    cancelAnimation(true);

    if (props.slide) {
      const fromRows = node.style.gridTemplateRows || "1fr";
      if (innerEl) innerEl.style.overflow = "hidden";
      node.style.gridTemplateRows = "0fr";
      const current = node.animate(
        { gridTemplateRows: [fromRows, "0fr"] },
        { duration, easing: "ease-out" },
      );
      animation = current;
      void current.finished.then(
        () => {
          if (token !== myToken || animation !== current) return;
          animation = undefined;
          setEl(undefined);
          setMounted(false);
        },
        () => undefined,
      );
      return;
    }

    const from = node.style.opacity || getComputedStyle(node).opacity || "1";
    node.style.opacity = "0";
    const current = node.animate(
      { opacity: [from, "0"] },
      { duration, easing: "ease-out" },
    );
    animation = current;
    void current.finished.then(
      () => {
        if (token !== myToken || animation !== current) return;
        animation = undefined;
        setEl(undefined);
        setMounted(false);
      },
      () => undefined,
    );
  };

  // Run enter after the element (and slide inner child) is attached to the DOM.
  createEffect(
    on(el, (node) => {
      if (node !== undefined && props.when) {
        runEnter(node);
      }
    }),
  );

  createEffect(
    on(
      () => props.when,
      (visible) => {
        if (visible) {
          const node = el();
          if (mounted() && node !== undefined) {
            runEnter(node);
          } else {
            setMounted(true);
          }
        } else if (mounted()) {
          runExit(el());
        }
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    token++;
    cancelAnimation(false);
    innerEl = undefined;
  });

  return (
    <Show when={mounted()}>
      <Show
        when={props.slide}
        fallback={
          <div ref={setEl} class={props.class}>
            {props.children}
          </div>
        }
      >
        <div ref={setEl} class={cn("grid", props.class)}>
          <div ref={(node) => (innerEl = node)} class="min-h-0">
            {props.children}
          </div>
        </div>
      </Show>
    </Show>
  );
}
