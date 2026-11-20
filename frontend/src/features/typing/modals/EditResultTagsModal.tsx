import { createEffect, createSignal, For } from "solid-js";

import { updateTags } from "../../../data/collections/results";
import { useTagsLiveQuery } from "../../../data/collections/tags";
import { AnimatedModal } from "../../../ts/components/common/AnimatedModal";
import { Button } from "../../../ts/components/common/Button";
import { getSelectedResult } from "../../../ts/states/edit-result-tags";
import { hideLoaderBar, showLoaderBar } from "../../../ts/states/loader-bar";
import { hideModal } from "../../../ts/states/modals";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../ts/states/notifications";
import { areUnsortedArraysEqual } from "../../../ts/utils/arrays";
import { createErrorMessage } from "../../../ts/utils/error";
import { updateTagsAfterEdit } from "../runtime/result/screen";

export function EditResultTagsModal() {
  const [selectedTagIds, setSelectedTagIds] = createSignal<Set<string>>(
    new Set([]),
  );

  const tags = useTagsLiveQuery();

  createEffect(() => {
    const resultTags = getSelectedResult()?.tags ?? [];
    const knownTagIds = new Set(tags().map((tag) => tag._id));
    const filtered = resultTags.filter((id) => knownTagIds.has(id));
    setSelectedTagIds(new Set(filtered));
  });

  return (
    <AnimatedModal
      id="EditResultTags"
      title="Edit result tags"
      modalClass="max-w-xl"
    >
      <div class="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2">
        <For each={tags()}>
          {(tag) => (
            <Button
              text={tag.name}
              class="w-full min-h-10 min-w-0 [overflow-wrap:anywhere] sm:min-h-0"
              active={selectedTagIds().has(tag._id)}
              onClick={() => {
                const current = new Set(selectedTagIds());
                if (current.has(tag._id)) {
                  current.delete(tag._id);
                } else {
                  current.add(tag._id);
                }
                setSelectedTagIds(current);
              }}
            />
          )}
        </For>
      </div>
      <Button
        class="w-full"
        text="save"
        onClick={() => {
          const selected = getSelectedResult();
          if (selected === null) return;
          const currentTagIds = selected.tags ?? [];
          const newTagIds = [...selectedTagIds()];

          if (areUnsortedArraysEqual(currentTagIds, newTagIds)) {
            hideModal("EditResultTags");
            return;
          }

          showLoaderBar();

          void updateTags({
            client: selected.client,
            resultId: selected._id,
            currentTagIds,
            newTagIds,
          })
            .then(({ tagPbs }) => {
              if (selected.source === "resultPage") {
                updateTagsAfterEdit(newTagIds, tagPbs);
              }
              showSuccessNotification("Tags updated", { durationMs: 2000 });
            })
            .catch((e: unknown) => {
              const message = createErrorMessage(e, "Failed to update tags");
              showErrorNotification(message);
            })
            .finally(() => {
              hideLoaderBar();
              hideModal("EditResultTags");
            });
        }}
      />
    </AnimatedModal>
  );
}
