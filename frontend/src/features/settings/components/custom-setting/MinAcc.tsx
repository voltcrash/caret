import { MinimumAccuracyCustomSchema } from "@caret/schemas/configs";
import { createForm } from "@tanstack/solid-form";
import { JSXElement } from "solid-js";

// import { showSuccessNotification } from "#shared/states/notifications.ts";
import { Button } from "#shared/components/common/Button.tsx";
import { InputField } from "#shared/components/ui/form/InputField.tsx";
import { fromSchema } from "#shared/components/ui/form/utils.ts";
import { configMetadata } from "#shared/config/metadata.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { getConfig } from "#shared/config/store.ts";

import { useSavedIndicator } from "../../hooks/useSavedIndicator";
import { SearchableSetting } from "../SearchableSetting";

export function MinAcc(): JSXElement {
  const savedIndicator = useSavedIndicator();

  const form = createForm(() => ({
    defaultValues: {
      minAccCustom: getConfig.minAccCustom,
    },
    onSubmit: ({ value }) => {
      const val = value.minAccCustom;
      if (val === getConfig.minAccCustom) return;
      if (getConfig.minAcc === "custom") {
        //
      } else {
        setConfig("minAcc", "custom");
      }
      savedIndicator.flash();
      setConfig("minAccCustom", val);
    },
  }));

  return (
    <SearchableSetting
      key="minAcc"
      resetKeys={["minAccCustom", "minAcc"]}
      onReset={() => form.reset({ minAccCustom: getConfig.minAccCustom })}
      title={configMetadata.minAcc.displayString ?? "min accuracy"}
      fa={configMetadata.minAcc.fa}
      description={configMetadata.minAcc.description}
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
              name="minAccCustom"
              validators={{
                onChange: fromSchema(MinimumAccuracyCustomSchema),
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
                    schema={MinimumAccuracyCustomSchema}
                    placeholder={
                      configMetadata.minAcc.displayString ?? "min accuracy"
                    }
                    type="number"
                    resetToDefaultIfEmptyOnBlur
                  />
                  <savedIndicator.component />
                </div>
              )}
            />
          </form>
          {/* <input class="w-full" value={inputValue()} /> */}
          <div class="grid grid-cols-2 gap-2">
            <Button
              active={getConfig.minAcc === "off"}
              onClick={() => {
                if (getConfig.minAcc === "off") return;
                setConfig("minAcc", "off");
              }}
            >
              off
            </Button>
            <Button
              active={getConfig.minAcc === "custom"}
              onClick={() => {
                if (getConfig.minAcc === "custom") return;
                setConfig("minAcc", "custom");
              }}
            >
              custom
            </Button>
          </div>
        </div>
      }
    />
  );
}
