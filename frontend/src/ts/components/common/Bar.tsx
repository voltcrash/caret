import { createEffect, JSXElement, onCleanup } from "solid-js";

import { applyReducedMotion } from "../../utils/misc";
import { Balloon } from "./Balloon";

type Props = {
  percent: number;
  fill: "main" | "text";
  bg: "bg" | "sub-alt";
  showPercentageOnHover?: boolean;
  animationDuration?: number;
  animationEase?: string;
};

const bgClassMap: Record<Props["bg"], string> = {
  bg: "bg-bg",
  "sub-alt": "bg-sub-alt",
};

const fillClassMap: Record<Props["fill"], string> = {
  main: "bg-main",
  text: "bg-text",
};

const EASE_MAP: Record<string, string> = {
  linear: "linear",
  "out(2)": "cubic-bezier(0.5, 1, 0.89, 1)",
  "out(5)": "cubic-bezier(0.22, 1, 0.36, 1)",
};

function resolveEasing(ease: string | undefined): string {
  if (ease === undefined) return "cubic-bezier(0.5, 1, 0.89, 1)";
  return EASE_MAP[ease] ?? ease;
}

export function Bar(props: Props): JSXElement {
  let fillEl: HTMLDivElement | undefined;
  let animation: Animation | undefined;

  createEffect(() => {
    const percent = props.percent;
    const duration = applyReducedMotion(props.animationDuration ?? 0);
    const easing = resolveEasing(props.animationEase);

    if (fillEl === undefined) return;

    if (animation !== undefined) {
      if (animation.playState !== "finished") {
        try {
          animation.commitStyles();
        } catch {
          // Unrendered elements fall back to inline width.
        }
      }
      animation.cancel();
      animation = undefined;
    }

    const from = fillEl.style.width || "0%";
    const to = `${percent}%`;
    fillEl.style.width = to;

    if (duration > 0 && from !== to) {
      const current = fillEl.animate(
        { width: [from, to] },
        { duration, easing },
      );
      animation = current;
      void current.finished.then(
        () => {
          if (animation === current) animation = undefined;
        },
        () => undefined,
      );
    }
  });

  onCleanup(() => {
    animation?.cancel();
    animation = undefined;
  });

  return (
    <Balloon
      class={`h-[0.5em] flex-1 rounded ${bgClassMap[props.bg]}`}
      text={
        props.showPercentageOnHover ? `${props.percent.toFixed(2)}%` : undefined
      }
    >
      <div
        ref={(el) => (fillEl = el)}
        class={`h-[0.5em] rounded ${fillClassMap[props.fill]}`}
      ></div>
    </Balloon>
  );
}
