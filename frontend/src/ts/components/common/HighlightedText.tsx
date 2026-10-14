import { For, JSXElement, Show } from "solid-js";

import { highlightMatches } from "../../utils/strings";

export function HighlightedText(props: {
  text: string;
  matches: string[];
}): JSXElement {
  return (
    <For each={highlightMatches(props.text, props.matches)}>
      {(segment) => (
        <Show when={segment.matched} fallback={segment.text}>
          <span class="highlight text-main">{segment.text}</span>
        </Show>
      )}
    </For>
  );
}
