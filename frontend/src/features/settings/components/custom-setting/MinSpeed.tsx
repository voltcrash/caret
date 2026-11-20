import { MinWpmCustomSpeedSchema } from "@caret/schemas/configs";
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

export function MinSpeed(): JSXElement {
  const savedIndicator = useSavedIndicator();

  const form = createForm(() => ({
    defaultValues: {
      minWpmCustomSpeed: getConfig.minWpmCustomSpeed,
    },
    onSubmit: ({ value }) => {
      const val = value.minWpmCustomSpeed;
      if (val === getConfig.minWpmCustomSpeed) return;
      if (getConfig.minWpm === "custom") {
        //
      } else {
        setConfig("minWpm", "custom");
      }
      savedIndicator.flash();
      setConfig("minWpmCustomSpeed", val);
    },
  }));

  return (
    <SearchableSetting
      key="minSpeed"
      resetKeys={["minWpmCustomSpeed", "minWpm"]}
      onReset={() =>
        form.reset({ minWpmCustomSpeed: getConfig.minWpmCustomSpeed })
      }
      title={configMetadata.minWpm.displayString ?? "min speed"}
      fa={configMetadata.minWpm.fa}
      description={configMetadata.minWpm.description}
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
              name="minWpmCustomSpeed"
              validators={{
                onChange: fromSchema(MinWpmCustomSpeedSchema),
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
                    schema={MinWpmCustomSpeedSchema}
                    placeholder={
                      configMetadata.minWpm.displayString ?? "min speed"
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
              active={getConfig.minWpm === "off"}
              onClick={() => {
                if (getConfig.minWpm === "off") return;
                setConfig("minWpm", "off");
              }}
            >
              off
            </Button>
            <Button
              active={getConfig.minWpm === "custom"}
              onClick={() => {
                if (getConfig.minWpm === "custom") return;
                setConfig("minWpm", "custom");
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
