import type { JSXElement } from "solid-js";

/** The SSR preview reserves the same space before any account data exists. */
export function PersonalNotices(props: {
  average?: JSXElement;
  pb?: JSXElement;
  tags?: JSXElement;
}) {
  return (
    <div
      class="mx-auto grid h-11 w-full max-w-3xl grid-cols-3 items-center gap-1 text-xs text-sub sm:text-sm"
      data-ui-element="personalNotices"
    >
      <div class="min-w-0">{props.average}</div>
      <div class="min-w-0">{props.pb}</div>
      <div class="min-w-0">{props.tags}</div>
    </div>
  );
}
