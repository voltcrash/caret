import { For, JSXElement, Show } from "solid-js";

import { Balloon } from "#shared/components/common/Balloon.tsx";
import { Fa } from "#shared/components/common/Fa.tsx";
import { showEditResultTagsModal } from "#shared/states/edit-result-tags.ts";
import { cn } from "#shared/utils/cn.ts";

import { useTagsLiveQuery } from "../../../../data/collections/tags";
import { resultState, type ResultTag } from "../../state/result";

function Tag(props: { tag: ResultTag }): JSXElement {
  return (
    <Balloon tagid={props.tag.id} text={props.tag.ariaLabel}>
      {props.tag.name}
      <Show when={props.tag.pb}>
        <Fa icon="fa-crown" class="ml-2" />
      </Show>
    </Balloon>
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
        <Balloon
          as="button"
          type="button"
          class={cn(
            "textButton editTagsButton ml-[0.5em] px-[0.25em] py-0 max-sm:min-h-9 max-sm:min-w-9 max-sm:items-center",
            tags().savedResultId === undefined && "invisible",
          )}
          aria-label="Edit tags"
          text="Edit tags"
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
        </Balloon>
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
