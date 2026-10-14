import { For, JSXElement, Show } from "solid-js";

import { MessageContent } from "../../types/message-content";

export function TextContent(props: { content: MessageContent }): JSXElement {
  const lines = (): readonly string[] =>
    typeof props.content === "string" ? [props.content] : props.content;

  return (
    <For each={lines()}>
      {(line, index) => (
        <>
          <Show when={index() > 0}>
            <br />
          </Show>
          {line}
        </>
      )}
    </For>
  );
}
