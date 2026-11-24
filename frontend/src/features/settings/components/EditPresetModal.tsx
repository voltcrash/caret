import { ConfigGroupName, ConfigGroupNameSchema } from "@caret/schemas/configs";
import { PresetNameSchema, PresetType } from "@caret/schemas/presets";
import { createForm } from "@tanstack/solid-form";
import { createSignal, JSXElement, Show } from "solid-js";

import { AnimatedModal } from "#shared/components/common/AnimatedModal.tsx";
import { FullOrPartial } from "#shared/components/modals/preset/FullOrPartial.tsx";
import {
  getActiveSettingGroups,
  getCheckboxes,
  getConfigChanges,
} from "#shared/components/modals/preset/preset-modal-utils.ts";
import { Checkbox } from "#shared/components/ui/form/Checkbox.tsx";
import { InputField } from "#shared/components/ui/form/InputField.tsx";
import { SubmitButton } from "#shared/components/ui/form/SubmitButton.tsx";
import { fromSchema } from "#shared/components/ui/form/utils.ts";
import { createEffectOn } from "#shared/hooks/effects.ts";
import { hideLoaderBar, showLoaderBar } from "#shared/states/loader-bar.ts";
import { hideModal, isModalOpen } from "#shared/states/modals.ts";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "#shared/states/notifications.ts";
import { normalizeName } from "#shared/utils/strings.ts";

import { editPreset, getPreset } from "../../../data/collections/presets";
import { editPresetData } from "../state/edit-preset-modal";

export function EditPresetModal(): JSXElement {
  const [presetType, setPresetType] = createSignal<PresetType>("full");

  const form = createForm(() => ({
    defaultValues: {
      presetName: "",
      updateConfig: false,
      ...Object.fromEntries(
        ConfigGroupNameSchema.options.map((key) => [key, true]),
      ),
    } as { presetName: string; updateConfig: boolean } & Record<
      ConfigGroupName,
      boolean
    >,
    onSubmit: async ({ value }) => {
      const data = editPresetData();
      if (data === null) return;

      const parsedName = PresetNameSchema.safeParse(
        normalizeName(value.presetName),
      );
      if (!parsedName.success) {
        showNoticeNotification("Preset name is not valid");
        return;
      }

      const checkboxes = getCheckboxes(value);
      if (
        value.updateConfig &&
        presetType() === "partial" &&
        Object.values(checkboxes).every((v) => !v)
      ) {
        showNoticeNotification(
          "At least one setting group must be active while saving partial presets",
        );
        return;
      }

      hideModal("EditPresetModal");
      showLoaderBar();

      try {
        if (value.updateConfig) {
          const configChanges = getConfigChanges(presetType(), checkboxes);
          const activeSettingGroups: ConfigGroupName[] | null =
            presetType() === "partial"
              ? getActiveSettingGroups(checkboxes)
              : null;
          await editPreset({
            presetId: data.presetId,
            name: parsedName.data,
            config: configChanges,
            settingGroups: activeSettingGroups,
          });
        } else {
          await editPreset({
            presetId: data.presetId,
            name: parsedName.data,
          });
        }
        showSuccessNotification("Preset updated");
      } catch (e) {
        showErrorNotification(
          e instanceof Error ? e.message : "Failed to edit preset",
        );
      }

      hideLoaderBar();
    },
  }));

  createEffectOn(
    () => isModalOpen("EditPresetModal"),
    (open) => {
      if (!open) return;
      const data = editPresetData();
      if (data === null) return;

      form.reset();
      form.setFieldValue("presetName", data.name);

      const preset = getPreset(data.presetId);
      if (preset === undefined) return;

      if (preset.settingGroups === undefined || preset.settingGroups === null) {
        setPresetType("full");
        for (const key of ConfigGroupNameSchema.options) {
          form.setFieldValue(key, true);
        }
      } else {
        setPresetType("partial");
        for (const key of ConfigGroupNameSchema.options) {
          form.setFieldValue(key, preset.settingGroups.includes(key));
        }
      }
    },
  );

  const isUpdateConfig = () => {
    const formValues = form.useSelector((s) => s.values);
    return formValues().updateConfig;
  };

  return (
    <AnimatedModal id="EditPresetModal" title="Edit preset">
      <form
        class="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="presetName"
          validators={{
            onChange: fromSchema(PresetNameSchema, { convert: normalizeName }),
          }}
          children={(field) => (
            <InputField field={field} placeholder="preset name" />
          )}
        />
        <form.Field name="updateConfig">
          {(field) => (
            <Checkbox field={field} label="update config to current" />
          )}
        </form.Field>
        <Show when={isUpdateConfig()}>
          <FullOrPartial
            type={presetType()}
            onTypeChange={setPresetType}
            renderCheckbox={(group, label) => (
              <form.Field name={group as ConfigGroupName}>
                {(field) => <Checkbox field={field} label={label} />}
              </form.Field>
            )}
          />
        </Show>
        <SubmitButton form={form} variant="button" text="save" />
      </form>
    </AnimatedModal>
  );
}
