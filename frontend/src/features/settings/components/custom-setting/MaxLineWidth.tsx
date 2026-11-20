import { MaxLineWidthSchema } from "@caret/schemas/configs";
import { createForm } from "@tanstack/solid-form";
import { JSXElement } from "solid-js";

import { InputField } from "#shared/components/ui/form/InputField.tsx";
import { fromSchema } from "#shared/components/ui/form/utils.ts";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";

import { useSavedIndicator } from "../../hooks/useSavedIndicator";
import { SearchableSetting } from "../SearchableSetting";

export function MaxLineWidth(): JSXElement {
  const { component: SavedIndicator, flash } = useSavedIndicator();

  const form = createForm(() => ({
    defaultValues: {
      maxLineWidth: getConfig.maxLineWidth,
    },
    onSubmit: ({ value }) => {
      const val = value.maxLineWidth;

      if (val === getConfig.maxLineWidth) return;
      flash();
      setConfig("maxLineWidth", val);
    },
  }));

  return (
    <SearchableSetting
      key="maxLineWidth"
      onReset={() => form.reset({ maxLineWidth: getConfig.maxLineWidth })}
      title={configMetadata.maxLineWidth.displayString ?? "max line width"}
      fa={configMetadata.maxLineWidth.fa}
      description={configMetadata.maxLineWidth.description}
      inputs={
        <div class="grid w-full gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.Field
              name="maxLineWidth"
              validators={{
                onChange: fromSchema(MaxLineWidthSchema),
              }}
              listeners={{
                onBlur: () => {
                  void form.handleSubmit();
                },
              }}
              children={(field) => (
                <div class="relative">
                  <InputField
                    field={field}
                    schema={MaxLineWidthSchema}
                    placeholder={
                      configMetadata.maxLineWidth.displayString ??
                      "max line width"
                    }
                    resetToDefaultIfEmptyOnBlur
                    type="number"
                  />
                  <SavedIndicator />
                </div>
              )}
            />
          </form>
        </div>
      }
    />
  );
}
