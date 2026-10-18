import { JSXElement } from "solid-js";

import { useActiveTagsLiveQuery } from "../../../../ts/collections/tags";
import { Notice } from "./Notice";

export function TagsNotice(): JSXElement {
  const tags = useActiveTagsLiveQuery();
  return (
    <Notice
      when={tags().length > 0}
      icon={tags().length === 1 ? "fa-tag" : "fa-tags"}
      openCommandline="tags"
      text={tags()
        .map((tag) => tag.name)
        .join(", ")}
    />
  );
}
