import type { JSXElement } from "solid-js";

import { oxytypeMarkPath, oxytypeMarkViewBox } from "./oxytype-icon";

/** Inline brand mark; fills with currentColor via `fill-current`. */
export function OxytypeMark(props: { class?: string }): JSXElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={oxytypeMarkViewBox}
      aria-hidden="true"
      class={props.class}
    >
      <path d={oxytypeMarkPath}></path>
    </svg>
  );
}
