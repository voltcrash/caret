import type { JSXElement } from "solid-js";

/**
 * Oxytype mark: a sharp-cornered "O" ("oxy", Greek for sharp) whose counter
 * is a text caret. Drawn on a 48-unit grid; fill with `fill-current`.
 */
export const oxytypeMarkPath =
  "M24 5H41a2 2 0 0 1 2 2V24A19 19 0 1 1 24 5ZM24 13a4 4 0 0 0-4 4v14a4 4 0 0 0 8 0V17a4 4 0 0 0-4-4Z";

export const oxytypeMarkViewBox = "0 0 48 48";

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
