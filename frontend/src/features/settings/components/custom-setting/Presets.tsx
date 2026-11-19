import { JSXElement, For } from "solid-js";

import {
  deletePreset,
  usePresetsLiveQuery,
} from "../../../../data/collections/presets";
import { Button } from "../../../../ts/components/common/Button";
import { apply } from "../../../../ts/controllers/preset-controller";
import { showEditPresetModal } from "../../../../ts/states/edit-preset-modal";
import { showModal } from "../../../../ts/states/modals";
import { showSimpleModal } from "../../../../ts/states/simple-modal";
import { SearchableSetting } from "../SearchableSetting";

export function Presets(): JSXElement {
  const presets = usePresetsLiveQuery();

  return (
    <SearchableSetting
      key="presets"
      title="presets"
      description="Create settings presets that can be applied with one click. Remember to edit your preset if you make any changes - they don't save on their own."
      fa={{
        icon: "fa-sliders-h",
      }}
      inputs={
        <div class="grid gap-2">
          <For each={presets()}>
            {(preset) => (
              <div class="grid grid-cols-[1fr_auto_auto] gap-2">
                <Button
                  class="min-w-0"
                  onClick={() => {
                    void apply(preset._id);
                  }}
                >
                  <span class="min-w-0 truncate">{preset.name}</span>
                </Button>
                <Button
                  aria-label={`Edit preset ${preset.name}`}
                  fa={{
                    icon: "fa-pen",
                  }}
                  onClick={() => {
                    showEditPresetModal({
                      presetId: preset._id,
                      name: preset.name,
                    });
                  }}
                />
                <Button
                  aria-label={`Delete preset ${preset.name}`}
                  fa={{
                    icon: "fa-trash",
                  }}
                  onClick={() => {
                    showSimpleModal({
                      title: "Delete preset",
                      text: `Are you sure you want to delete preset "${preset.name}"? This action cannot be undone.`,
                      buttonText: "delete",
                      execFn: async () => {
                        await deletePreset({ presetId: preset._id });

                        return {
                          status: "success",
                          message: "Preset deleted",
                        };
                      },
                    });
                  }}
                />
              </div>
            )}
          </For>
          <Button
            text="add preset"
            onClick={() => {
              showModal("AddPresetModal");
            }}
          />
        </div>
      }
    />
  );
}
