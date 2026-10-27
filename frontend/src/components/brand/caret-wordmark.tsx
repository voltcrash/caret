import type { JSXElement } from "solid-js";

import { cn } from "../../ts/utils/cn";
import { CaretMark } from "./caret-mark";

/**
 * Brand mark followed by lowercase "caret". Inherits the surrounding font and
 * text color; the mark fills with `markClass` (main by default) and sits on
 * the text baseline.
 */
export function CaretWordmark(props: {
  class?: string;
  markClass?: string;
}): JSXElement {
  return (
    <span
      class={cn("inline-flex items-baseline whitespace-nowrap", props.class)}
    >
      <CaretMark
        class={cn(
          "mr-[0.25em] h-[0.7em] w-auto shrink-0 fill-current text-main",
          props.markClass,
        )}
      />
      caret
    </span>
  );
}
