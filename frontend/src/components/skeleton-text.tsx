import type { JSXElement } from "solid-js";

import { cn } from "../ts/utils/cn";

/**
 * One text line tall, so placeholder copy keeps the real copy's height. `bg`
 * suits placeholders on `bg-sub-alt` cards.
 */
export function SkeletonText(props: {
  class?: string;
  tone?: "sub" | "bg";
}): JSXElement {
  return (
    <div class={cn("flex h-lh w-full items-center", props.class)}>
      <div
        class={cn(
          "h-[0.6em] w-full rounded",
          props.tone === "bg" ? "bg-bg" : "bg-sub/20",
        )}
      ></div>
    </div>
  );
}
