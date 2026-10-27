import type { JSXElement } from "solid-js";

import { cn } from "../../ts/utils/cn";
import { CaretMark } from "./caret-mark";

/**
 * Lowercase "caret" with the brand mark standing in for the "t". Inherits the
 * surrounding font and text color; the mark fills with `markClass` (main by
 * default). Screen readers get the plain word. The drawn "care" comes from
 * CSS content so accessibility checks don't compare the partial word with
 * link names like "Caret Home".
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
        class={cn(
          "inline-flex items-baseline whitespace-nowrap before:content-['care']",
          props.class,
        )}
      >
        <CaretMark
          class={cn(
            "ml-[0.04em] h-[0.65em] w-auto shrink-0 fill-current text-main",
            props.markClass,
          )}
        />
      </span>
    </>
  );
}
