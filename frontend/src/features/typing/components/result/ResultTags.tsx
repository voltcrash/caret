import { For, JSXElement, Show } from "solid-js";

import { useTagsLiveQuery } from "../../../../ts/collections/tags";
import { buildBalloonHtmlProperties } from "../../../../ts/components/common/Balloon";
import { Fa } from "../../../../ts/components/common/Fa";
import { showEditResultTagsModal } from "../../../../ts/states/edit-result-tags";
import { resultState, type ResultTag } from "../../../../ts/states/result";
import { cn } from "../../../../ts/utils/cn";

function Tag(props: { tag: ResultTag }): JSXElement {
  const attrs = (): Record<string, string> => ({
    tagid: props.tag.id,
    ...buildBalloonHtmlProperties({ text: props.tag.ariaLabel }),
  });

  return (
    <div {...attrs()}>
      {props.tag.name}
      <Show when={props.tag.pb}>
        <Fa icon="fa-crown" class="ml-2" />
      </Show>
    </div>
  );
}

export function ResultTags(props: {
  topClass: string;
  bottomClass: string;
}): JSXElement {
  const tags = () => resultState.tags;
  const userTags = useTagsLiveQuery();

  return (
    <div class={cn("tags mt-2", !tags().visible && "hidden")}>
      <div class={props.topClass}>
        <span>tags</span>
        <div
          class={cn(
            "textButton editTagsButton ml-[0.5em] px-[0.25em] py-0 max-sm:min-h-9 max-sm:min-w-9 max-sm:items-center",
            tags().savedResultId === undefined && "invisible",
          )}
          aria-label="Edit tags"
          role="button"
          data-balloon-pos="right"
          onClick={() => {
            if (userTags().length === 0) return;
            showEditResultTagsModal({
              _id: tags().savedResultId ?? "",
              tags: tags().items.map((tag) => tag.id),
              source: "resultPage",
            });
          }}
        >
          <Fa icon="fa-pen" fixedWidth />
        </div>
      </div>
      <div class={props.bottomClass}>
        <Show
          when={tags().items.length > 0}
          fallback={<div class="noTags">no tags</div>}
        >
          <For each={tags().items}>{(tag) => <Tag tag={tag} />}</For>
        </Show>
      </div>
    </div>
  );
}
