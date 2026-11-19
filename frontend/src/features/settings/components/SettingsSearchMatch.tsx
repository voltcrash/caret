import { createMemo, For, JSXElement, Show } from "solid-js";

import { getSettingsSearchHighlights } from "../../../ts/utils/settings-search";
import { getSettingsSearchTokens } from "../search-state";

export function SettingsSearchMatch(props: {
  text: string;
  includeAliases?: boolean;
}): JSXElement {
  const parts = createMemo(() =>
    getSettingsSearchHighlights(
      props.text,
      getSettingsSearchTokens(),
      props.includeAliases,
    ),
  );
  return (
    <span>
      <Show when={getSettingsSearchTokens().length > 0} fallback={props.text}>
        <For each={parts()}>
          {(part) => (
            <Show when={part.matched} fallback={part.text}>
              <mark class="rounded-sm bg-main/20 text-inherit">
                {part.text}
              </mark>
            </Show>
          )}
        </For>
      </Show>
    </span>
  );
}
