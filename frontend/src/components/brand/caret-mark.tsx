import type { JSXElement } from "solid-js";

import { caretMarkInkViewBox, caretMarkPath } from "./caret-icon";

/**
 * Inline brand mark cropped to its ink; size it by height. Fills with
 * currentColor via `fill-current`.
 */
export function CaretMark(props: { class?: string }): JSXElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={caretMarkInkViewBox}
      aria-hidden="true"
      class={props.class}
    >
      <path d={caretMarkPath}></path>
    </svg>
  );
}
