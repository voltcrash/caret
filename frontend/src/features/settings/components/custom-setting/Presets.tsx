import { JSXElement, For } from "solid-js";

import { Button } from "#shared/components/common/Button.tsx";
import { apply } from "#shared/controllers/preset-controller.ts";
import { showEditPresetModal } from "#shared/states/edit-preset-modal.ts";
import { showModal } from "#shared/states/modals.ts";
import { showSimpleModal } from "#shared/states/simple-modal.ts";

import {
  deletePreset,
  usePresetsLiveQuery,
} from "../../../../data/collections/presets";
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
