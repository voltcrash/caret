import type { JSXElement } from "solid-js";

import { oxytypeMarkInkViewBox, oxytypeMarkPath } from "./oxytype-icon";

/**
 * Inline brand mark cropped to its ink; size it by height. Fills with
 * currentColor via `fill-current`.
 */
export function OxytypeMark(props: { class?: string }): JSXElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={oxytypeMarkInkViewBox}
      aria-hidden="true"
      class={props.class}
    >
      <path d={oxytypeMarkPath}></path>
    </svg>
  );
}
