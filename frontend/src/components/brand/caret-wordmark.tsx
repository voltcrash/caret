import type { JSXElement } from "solid-js";

import { cn } from "../../ts/utils/cn";
import { CaretMark } from "./caret-mark";

/**
 * Lowercase "caret" with the brand mark standing in for the "t". Inherits the
 * surrounding font and text color; the mark fills with `markClass` (main by
 * default). Screen readers get the plain word.
 */
export function CaretWordmark(props: {
  class?: string;
  markClass?: string;
}): JSXElement {
  return (
    <>
      <span class="sr-only">caret</span>
      <span
        aria-hidden="true"
        class={cn("inline-flex items-baseline whitespace-nowrap", props.class)}
      >
        care
        <CaretMark
          class={cn(
            "relative top-[0.2em] ml-[0.04em] h-[0.95em] w-auto shrink-0 fill-current text-main",
            props.markClass,
          )}
        />
      </span>
    </>
  );
}
